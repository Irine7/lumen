import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { testnetDemoRecipients } from "@lumen-aid/shared";
import { buildDemoComplianceTree, buildDemoEligibilityTree, createDemoCampaignConfig } from "@lumen-aid/merkle";
import { derivePayoutAccountHash } from "@lumen-aid/stellar";
import {
  AIDUSD_CODE,
  changeTrust,
  deployAidusdSac,
  ensureFundedKey,
  parseContractId,
  parsePublicKey,
  readAidusdDeployment,
  readTokenBalance,
  writeAidusdBlocker
} from "./stellar-aidusd-common";
import {
  activeCampaignConfigArgPath,
  activeTestnetPath,
  invokeContract,
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

type VerifierInfo = {
  verifier_id: string;
  circuit_id: string;
  verification_key_hash: string;
  mode: "real_groth16" | "dev_verifier";
  version: string;
};

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }
  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function as0xHex32(value: string): `0x${string}` {
  return `0x${strip0x(value).padStart(64, "0")}`;
}

function uniqueCampaignId(): `0x${string}` {
  const digest = createHash("sha256")
    .update(`lumen:testnet:aidusd-campaign:${Date.now()}:${process.pid}`)
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

async function main(): Promise<void> {
  try {
    const sourceAccount = requireCleanSourceAccount();
    run("pnpm", ["stellar:asset:setup-aidusd:testnet"]);
    run("pnpm", ["contracts:build"]);

    const aidusd = await readAidusdDeployment();
    const operatorResult = run("stellar", ["keys", "public-key", sourceAccount], {
      suppressCommand: true,
      suppressOutput: true
    });
    const operator = parsePublicKey(operatorResult.stdout, "operator");

    const verifierContractId = deployContract("verifier", verifierWasm, sourceAccount);
    const verifierInfo = readVerifierInfo(verifierContractId, sourceAccount);
    if (verifierInfo.mode !== "real_groth16" || verifierInfo.version !== "claim_v0") {
      throw new Error(`AIDUSD campaign requires real_groth16 claim_v0 verifier; got ${JSON.stringify(verifierInfo)}`);
    }

    const assetContractId = deployAidusdSac(sourceAccount, aidusd.issuerPublicKey);
    const campaignContractId = deployContract("campaign", campaignWasm, sourceAccount);

    const payoutAddressById = Object.fromEntries(
      testnetDemoRecipients.map((recipient) => {
        const keyName = `lumen-recipient-${recipient.id}`;
        const publicKey = ensureFundedKey(keyName);
        changeTrust(keyName, aidusd.issuerPublicKey);
        return [recipient.id, publicKey];
      })
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
      throw new Error(`AIDUSD escrow funding failed: expected ${escrowFunded}, got ${escrowBalance}`);
    }

    const active: ActiveTestnetDeployment = {
      network: "testnet",
      assetMode: "aidusd_sac",
      assetCode: AIDUSD_CODE,
      assetIssuer: aidusd.issuerPublicKey,
      assetContractId,
      campaignContractId,
      verifierContractId,
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
        "Public active Stellar testnet AIDUSD payout deployment. Recipient secrets, witness data, Merkle paths, and private inputs are intentionally not written here."
    };

    await writeJson(activeTestnetPath, active);

    console.log(`[ok] wrote ${activeTestnetPath}`);
    console.log(`[ok] active campaign ID: ${active.campaignId}`);
    console.log(`[ok] AIDUSD issuer: ${aidusd.issuerPublicKey}`);
    console.log(`[ok] AIDUSD SAC contract ID: ${assetContractId}`);
    console.log(`[ok] AIDUSD escrow balance: ${readTokenBalance({
      assetContractId,
      sourceAccount,
      id: campaignContractId
    })}`);
    console.log("[ok] fresh AIDUSD payout campaign ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeAidusdBlocker(message);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
