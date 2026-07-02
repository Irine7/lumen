import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { testnetDemoRecipients } from "@lumen-aid/shared";
import { buildDemoEligibilityTree, createDemoCampaignConfig } from "@lumen-aid/merkle";
import {
  activeCampaignConfigArgPath,
  activeTestnetPath,
  invokeContract,
  readDeployment,
  readJson,
  requireCleanSourceAccount,
  run,
  strip0x,
  writeJson,
  repoRoot,
  type ActiveTestnetDeployment,
  type TestnetDeployment
} from "./stellar-testnet-common";

const wasmTarget = "wasm32v1-none";
const verifierWasm = join(repoRoot, "target", wasmTarget, "release", "lumen_verifier.wasm");
const campaignWasm = join(repoRoot, "target", wasmTarget, "release", "lumen_campaign.wasm");
const mockTokenWasm = join(repoRoot, "target", wasmTarget, "release", "lumen_mock_token.wasm");

interface VerifierInfo {
  verifier_id: string;
  circuit_id: string;
  verification_key_hash: string;
  mode: "real_groth16" | "dev_verifier";
  version: string;
}

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }

  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function parseContractId(output: string, label: string): string {
  const matches = output.match(/\bC[A-Z2-7]{55}\b/g);
  const contractId = matches?.at(-1);
  if (!contractId) {
    throw new Error(`Could not parse ${label} contract ID from Stellar CLI output.`);
  }
  return contractId;
}

function parsePublicKey(output: string): string {
  const match = output.match(/\bG[A-Z2-7]{55}\b/);
  if (!match) {
    throw new Error("Could not parse source account public key from Stellar CLI output.");
  }
  return match[0];
}

function deployContract(label: string, wasm: string, sourceAccount: string): string {
  if (!existsSync(wasm)) {
    throw new Error(`Missing ${label} WASM artifact: ${wasm}`);
  }

  const result = run("stellar", [
    "contract",
    "deploy",
    "--wasm",
    wasm,
    "--source-account",
    sourceAccount,
    "--network",
    "testnet"
  ]);
  if (result.status !== 0) {
    throw new Error(`${label} deployment failed`);
  }

  const contractId = parseContractId(`${result.stdout}\n${result.stderr}`, label);
  console.log(`[ok] ${label} contract id: ${contractId}`);
  return contractId;
}

function tryReadVerifierInfo(verifierContractId: string, sourceAccount: string): VerifierInfo | null {
  const result = invokeContract({
    contractId: verifierContractId,
    sourceAccount,
    fn: "verifier_info",
    allowFailure: true,
    send: "no",
    suppressOutput: true
  });

  if (result.status !== 0) {
    return null;
  }

  try {
    return parseJson<VerifierInfo>(result.stdout, "verifier_info");
  } catch {
    return null;
  }
}

function uniqueCampaignId(): `0x${string}` {
  const digest = createHash("sha256")
    .update(`lumen:testnet:campaign:${Date.now()}:${process.pid}`)
    .digest("hex");
  return `0x00${digest.slice(0, 62)}`;
}

async function maybeReadDeployment(): Promise<TestnetDeployment | null> {
  try {
    return await readDeployment();
  } catch {
    return null;
  }
}

async function maybeReadActiveDeployment(): Promise<ActiveTestnetDeployment | null> {
  if (!existsSync(activeTestnetPath)) {
    return null;
  }

  try {
    const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
    return active.network === "testnet" ? active : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();

  const doctor = run("pnpm", ["stellar:doctor"]);
  if (doctor.status !== 0) {
    throw new Error("Stellar preflight failed");
  }

  const build = run("pnpm", ["contracts:build"]);
  if (build.status !== 0) {
    throw new Error("Contract WASM build failed");
  }

  const publicKeyResult = run("stellar", ["keys", "public-key", sourceAccount], {
    suppressCommand: true,
    suppressOutput: true
  });
  if (publicKeyResult.status !== 0) {
    throw new Error(`Could not resolve public key for ${sourceAccount}`);
  }
  const operator = parsePublicKey(publicKeyResult.stdout);

  const [existingActiveDeployment, existingDeployment] = await Promise.all([
    maybeReadActiveDeployment(),
    maybeReadDeployment()
  ]);
  const verifierCandidates = [
    existingActiveDeployment?.verifierContractId,
    existingDeployment?.verifierContractId
  ].filter((value): value is string => Boolean(value));
  const reusableVerifier = verifierCandidates
    .map((contractId) => ({
      contractId,
      info: tryReadVerifierInfo(contractId, sourceAccount)
    }))
    .find(
      (candidate) =>
        candidate.info?.mode === "real_groth16" && candidate.info.version === "claim_v0"
    );

  let verifierContractId = reusableVerifier?.contractId ?? verifierCandidates[0];
  let verifierInfo = reusableVerifier?.info ?? null;
  if (
    !verifierContractId ||
    !verifierInfo ||
    verifierInfo.mode !== "real_groth16" ||
    verifierInfo.version !== "claim_v0"
  ) {
    if (verifierContractId && !verifierInfo) {
      console.log("[ok] Existing verifier is legacy; deploying introspectable verifier");
    } else if (verifierInfo?.mode === "dev_verifier") {
      console.log("[ok] Existing verifier is dev_verifier; deploying real Groth16 verifier");
    }
    verifierContractId = deployContract("verifier", verifierWasm, sourceAccount);
    verifierInfo = tryReadVerifierInfo(verifierContractId, sourceAccount);
  } else {
    console.log("[ok] Reusing existing ABI-compatible real verifier");
  }

  if (!verifierInfo || verifierInfo.mode !== "real_groth16") {
    throw new Error("Fresh campaign requires an introspectable real_groth16 verifier");
  }

  const mockTokenContractId =
    existingActiveDeployment?.mockTokenContractId ??
    existingDeployment?.mockTokenContractId ??
    deployContract("mock token", mockTokenWasm, sourceAccount);
  const campaignContractId = deployContract("campaign", campaignWasm, sourceAccount);

  const tree = buildDemoEligibilityTree(testnetDemoRecipients);
  const campaign = {
    ...createDemoCampaignConfig(tree),
    campaignId: uniqueCampaignId(),
    operator,
    asset: mockTokenContractId,
    verifier: verifierContractId,
    startLedger: 1,
    endLedger: 4_294_967_295
  };

  const config = {
    asset: mockTokenContractId,
    budget: String(campaign.budget),
    campaign_id: strip0x(campaign.campaignId),
    deny_root: null,
    eligibility_root: strip0x(campaign.eligibilityRoot),
    end_ledger: campaign.endLedger,
    is_active: true,
    operator,
    per_recipient_cap: String(campaign.perRecipientCap),
    policy_hash: strip0x(campaign.policyHash),
    start_ledger: campaign.startLedger,
    verifier: verifierContractId
  };
  await writeJson(activeCampaignConfigArgPath, config);

  const initialize = invokeContract({
    contractId: campaignContractId,
    sourceAccount,
    fn: "initialize",
    fnArgs: ["--config-file-path", activeCampaignConfigArgPath]
  });
  if (initialize.status !== 0) {
    throw new Error("Fresh campaign initialization failed");
  }

  const active: ActiveTestnetDeployment = {
    network: "testnet",
    campaignContractId,
    verifierContractId,
    mockTokenContractId,
    campaignId: campaign.campaignId,
    eligibilityRoot: campaign.eligibilityRoot,
    policyHash: campaign.policyHash,
    operator,
    asset: mockTokenContractId,
    budget: String(campaign.budget),
    perRecipientCap: String(campaign.perRecipientCap),
    startLedger: campaign.startLedger,
    endLedger: campaign.endLedger,
    createdAt: new Date().toISOString(),
    verifierInfo: {
      mode: verifierInfo.mode,
      version: verifierInfo.version,
      verifierId: verifierInfo.verifier_id,
      circuitId: verifierInfo.circuit_id,
      verificationKeyHash: verifierInfo.verification_key_hash
    },
    recipients: testnetDemoRecipients.map((recipient) => ({
      id: recipient.id,
      displayName: recipient.displayName,
      eligible: recipient.eligible,
      defaultClaimAmount: recipient.defaultClaimAmount
    })),
    notes:
      "Public active Stellar testnet deployment. Recipient secrets, witness data, Merkle paths, and private inputs are intentionally not written here."
  };

  await writeJson(activeTestnetPath, active);
  console.log(`[ok] wrote ${activeTestnetPath}`);
  console.log(`[ok] active campaign ID: ${active.campaignId}`);
  console.log(`[ok] active eligibility root: ${active.eligibilityRoot}`);
  console.log(`[ok] verifier mode: ${active.verifierInfo.mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
