import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { testnetDemoRecipients } from "@lumen-aid/shared";
import {
  buildDemoComplianceTree,
  buildDemoEligibilityTree,
  createDemoCampaignConfig
} from "@lumen-aid/merkle";
import { derivePayoutAccountHash, nativeTestnetAssetContractId } from "@lumen-aid/stellar";
import {
  activeCampaignConfigArgPath,
  activeTestnetPath,
  invokeContract,
  readJson,
  requireCleanSourceAccount,
  run,
  strip0x,
  writeJson,
  repoRoot,
  type ActiveTestnetDeployment
} from "./stellar-testnet-common";

const wasmTarget = "wasm32v1-none";
const verifierWasm = join(repoRoot, "target", wasmTarget, "release", "lumen_verifier.wasm");
const campaignWasm = join(repoRoot, "target", wasmTarget, "release", "lumen_campaign.wasm");
const budget = 1000;
const escrowFunded = 1000;
const expectedVerificationKeyHash =
  "0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92";

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

function parsePublicKey(output: string, label: string): string {
  const match = output.match(/\bG[A-Z2-7]{55}\b/);
  if (!match) {
    throw new Error(`Could not parse ${label} public key from Stellar CLI output.`);
  }
  return match[0];
}

function as0xHex32(value: string): `0x${string}` {
  return `0x${strip0x(value).padStart(64, "0")}`;
}

function uniqueCampaignId(): `0x${string}` {
  const digest = createHash("sha256")
    .update(`lumen:testnet:payout-campaign:${Date.now()}:${process.pid}`)
    .digest("hex");
  return `0x00${digest.slice(0, 62)}`;
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
  const contractId = parseContractId(`${result.stdout}\n${result.stderr}`, label);
  console.log(`[ok] ${label} contract id: ${contractId}`);
  return contractId;
}

function deployNativeAssetContract(sourceAccount: string): string {
  const result = run("stellar", [
    "contract",
    "asset",
    "deploy",
    "--asset",
    "native",
    "--source-account",
    sourceAccount,
    "--network",
    "testnet"
  ], { allowFailure: true, suppressOutput: true });
  if (result.status !== 0) {
    const text = `${result.stdout}\n${result.stderr}`;
    if (text.includes("ExistingValue") || text.includes("contract already exists")) {
      const contractId = nativeTestnetAssetContractId();
      console.log(`[ok] native XLM SAC already deployed: ${contractId}`);
      return contractId;
    }
    throw new Error("Native XLM SAC deployment failed");
  }
  const contractId = parseContractId(`${result.stdout}\n${result.stderr}`, "native XLM SAC");
  console.log(`[ok] native XLM SAC contract id: ${contractId}`);
  return contractId;
}

function readVerifierInfo(verifierContractId: string, sourceAccount: string): VerifierInfo {
  const result = invokeContract({
    contractId: verifierContractId,
    sourceAccount,
    fn: "verifier_info",
    send: "no",
    suppressOutput: true
  });
  return parseJson<VerifierInfo>(result.stdout, "verifier_info");
}

function getLocalKeyPublicKey(keyName: string): string | null {
  const result = run("stellar", ["keys", "public-key", keyName], {
    allowFailure: true,
    suppressCommand: true,
    suppressOutput: true
  });
  if (result.status !== 0) {
    return null;
  }
  return parsePublicKey(result.stdout, keyName);
}

function ensureFundedTestnetKey(keyName: string): string {
  const existing = getLocalKeyPublicKey(keyName);
  if (existing) {
    run("stellar", ["keys", "fund", keyName, "--network", "testnet"], {
      allowFailure: true,
      suppressCommand: true,
      suppressOutput: true
    });
    return existing;
  }

  const generate = run("stellar", ["keys", "generate", keyName, "--fund", "--network", "testnet"], {
    suppressCommand: true,
    suppressOutput: true
  });
  if (generate.status !== 0) {
    throw new Error(`Could not generate funded testnet key ${keyName}`);
  }

  const created = getLocalKeyPublicKey(keyName);
  if (!created) {
    throw new Error(`Could not read generated public key ${keyName}`);
  }
  return created;
}

function readTokenBalance(args: {
  assetContractId: string;
  sourceAccount: string;
  id: string;
}): string {
  const result = invokeContract({
    contractId: args.assetContractId,
    sourceAccount: args.sourceAccount,
    fn: "balance",
    fnArgs: ["--id", args.id],
    send: "no",
    suppressOutput: true
  });
  const match = result.stdout.match(/-?\d+/);
  return match?.[0] ?? "0";
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();

  run("pnpm", ["stellar:doctor"]);
  run("pnpm", ["contracts:build"]);

  const operatorResult = run("stellar", ["keys", "public-key", sourceAccount], {
    suppressCommand: true,
    suppressOutput: true
  });
  const operator = parsePublicKey(operatorResult.stdout, "operator");

  const verifierContractId = deployContract("verifier", verifierWasm, sourceAccount);
  const verifierInfo = readVerifierInfo(verifierContractId, sourceAccount);
  if (
    verifierInfo.mode !== "real_groth16" ||
    verifierInfo.version !== "claim_v0" ||
    as0xHex32(verifierInfo.verification_key_hash).toLowerCase() !==
      expectedVerificationKeyHash.toLowerCase()
  ) {
    throw new Error(
      `Fresh payout campaign requires real_groth16 claim_v0 verifier key ${expectedVerificationKeyHash}; got ${JSON.stringify(
        verifierInfo
      )}`
    );
  }

  const assetContractId = deployNativeAssetContract(sourceAccount);
  const campaignContractId = deployContract("campaign", campaignWasm, sourceAccount);

  const payoutAddressById = Object.fromEntries(
    testnetDemoRecipients.map((recipient) => [
      recipient.id,
      ensureFundedTestnetKey(`lumen-recipient-${recipient.id}`)
    ])
  ) as Record<string, string>;

  const tree = buildDemoEligibilityTree(testnetDemoRecipients);
  const complianceTree = buildDemoComplianceTree(testnetDemoRecipients);
  const campaign = {
    ...createDemoCampaignConfig(tree, complianceTree),
    campaignId: uniqueCampaignId(),
    operator,
    asset: assetContractId,
    verifier: verifierContractId,
    budget,
    perRecipientCap: 250,
    startLedger: 1,
    endLedger: 4_294_967_295,
    isActive: true
  };

  const config = {
    asset: assetContractId,
    budget: String(campaign.budget),
    campaign_id: strip0x(campaign.campaignId),
    compliance_root: strip0x(campaign.complianceRoot),
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

  invokeContract({
    contractId: campaignContractId,
    sourceAccount,
    fn: "initialize",
    fnArgs: ["--config-file-path", activeCampaignConfigArgPath]
  });

  invokeContract({
    contractId: campaignContractId,
    sourceAccount,
    fn: "fund_campaign",
    fnArgs: ["--from", operator, "--amount", String(escrowFunded)]
  });

  const escrowResult = invokeContract({
    contractId: campaignContractId,
    sourceAccount,
    fn: "get_escrow_balance",
    send: "no",
    suppressOutput: true
  });
  const escrowBalance = escrowResult.stdout.match(/-?\d+/)?.[0] ?? "0";
  if (BigInt(escrowBalance) < BigInt(escrowFunded)) {
    throw new Error(`Escrow funding failed: expected at least ${escrowFunded}, got ${escrowBalance}`);
  }

  const active: ActiveTestnetDeployment = {
    network: "testnet",
    campaignContractId,
    verifierContractId,
    assetContractId,
    assetMode: "native_xlm_sac",
    assetCode: "XLM",
    campaignId: campaign.campaignId,
    eligibilityRoot: campaign.eligibilityRoot,
    complianceRoot: campaign.complianceRoot,
    policyHash: campaign.policyHash,
    operator,
    asset: assetContractId,
    budget: String(campaign.budget),
    escrowFunded: escrowBalance,
    perRecipientCap: String(campaign.perRecipientCap),
    startLedger: campaign.startLedger,
    endLedger: campaign.endLedger,
    createdAt: new Date().toISOString(),
    verifierInfo: {
      mode: verifierInfo.mode,
      version: verifierInfo.version,
      verifierId: as0xHex32(verifierInfo.verifier_id),
      circuitId: as0xHex32(verifierInfo.circuit_id),
      verificationKeyHash: as0xHex32(verifierInfo.verification_key_hash)
    },
    recipients: testnetDemoRecipients.map((recipient) => {
      const payoutAddress = payoutAddressById[recipient.id]!;
      return {
        id: recipient.id,
        name: recipient.displayName,
        displayName: recipient.displayName,
        eligible: recipient.eligible,
        compliant: recipient.compliant,
        defaultClaimAmount: recipient.defaultClaimAmount,
        payoutAddress,
        payoutAccountHash: derivePayoutAccountHash(payoutAddress)
      };
    }),
    notes:
      "Public active Stellar testnet payout deployment. Native testnet XLM SAC backs the campaign escrow. Recipient secrets, witness data, Merkle paths, and private inputs are intentionally not written here."
  };

  await writeJson(activeTestnetPath, active);

  console.log(`[ok] wrote ${activeTestnetPath}`);
  console.log(`[ok] active campaign ID: ${active.campaignId}`);
  console.log(`[ok] native XLM escrow balance: ${readTokenBalance({
    assetContractId,
    sourceAccount,
    id: campaignContractId
  })}`);
  console.log("[ok] fresh real payout campaign ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
