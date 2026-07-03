import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  invokeContract,
  readDeployment,
  readJson,
  requireCleanSourceAccount,
  strip0x,
  type TestnetCampaignState
} from "./stellar-testnet-common";
import { campaignStatePath } from "./stellar-testnet-common";

interface CampaignConfig {
  asset: string;
  budget: string;
  campaign_id: string;
  compliance_root: string;
  deny_root: string | null;
  eligibility_root: string;
  end_ledger: number;
  is_active: boolean;
  operator: string;
  per_recipient_cap: string;
  policy_hash: string;
  start_ledger: number;
  verifier: string;
}

interface CampaignStats {
  claim_count: number;
  duplicate_claims_blocked: number;
  invalid_claims_blocked: number;
  remaining_budget: string;
  total_claimed: string;
}

interface VerifierInfo {
  verifier_id: string;
  circuit_id: string;
  verification_key_hash: string;
  mode: "real_groth16" | "dev_verifier";
  version: "claim_v0" | string;
}

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }

  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function tryReadVerifierInfo(args: {
  verifierContractId: string;
  sourceAccount: string;
}): VerifierInfo | null {
  const result = invokeContract({
    contractId: args.verifierContractId,
    sourceAccount: args.sourceAccount,
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

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
  console.log(`[ok] ${label}: ${actual}`);
}

function zeroHex32(): string {
  return "0".repeat(64);
}

async function verifierCallable(args: {
  verifierContractId: string;
  sourceAccount: string;
}): Promise<"callable_false" | "unexpected_true"> {
  const tempDir = await mkdtemp(join(tmpdir(), "lumen-testnet-read-"));
  const publicInputsPath = join(tempDir, "verifier-public-inputs.json");

  try {
    await writeFile(
      publicInputsPath,
      `${JSON.stringify(
        {
          amount: "1",
          amount_commitment: zeroHex32(),
          campaign_id: zeroHex32(),
          compliance_root: zeroHex32(),
          eligibility_root: zeroHex32(),
          max_amount: "1",
          nullifier_hash: zeroHex32(),
          payout_account_hash: zeroHex32(),
          policy_hash: zeroHex32(),
          recipient_commitment: zeroHex32()
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = invokeContract({
      contractId: args.verifierContractId,
      sourceAccount: args.sourceAccount,
      fn: "verify_claim",
      fnArgs: ["--public_inputs-file-path", publicInputsPath, "--proof", "00"],
      send: "no",
      suppressOutput: true
    });

    if (/\btrue\b/.test(result.stdout)) {
      return "unexpected_true";
    }
    if (/\bfalse\b/.test(result.stdout)) {
      return "callable_false";
    }

    throw new Error("Verifier call completed but did not return a boolean");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const deployment = await readDeployment();
  const campaignState = await readJson<TestnetCampaignState>(campaignStatePath);

  const configResult = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "get_campaign",
    send: "no",
    suppressOutput: true
  });
  const config = parseJson<CampaignConfig>(configResult.stdout, "get_campaign");
  console.log("[ok] campaign contract callable: get_campaign");

  const statsResult = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "get_stats",
    send: "no",
    suppressOutput: true
  });
  const stats = parseJson<CampaignStats>(statsResult.stdout, "get_stats");
  console.log("[ok] campaign stats callable: get_stats");

  expectEqual(config.campaign_id, strip0x(campaignState.campaignId), "campaign ID");
  expectEqual(config.compliance_root, strip0x(campaignState.complianceRoot), "compliance root");
  expectEqual(config.eligibility_root, strip0x(campaignState.eligibilityRoot), "eligibility root");
  expectEqual(config.policy_hash, strip0x(campaignState.policyHash), "policy hash");
  expectEqual(config.verifier, deployment.verifierContractId, "verifier contract ID");
  expectEqual(config.asset, deployment.mockTokenContractId, "mock token contract ID");
  expectEqual(config.budget, campaignState.budget, "budget");
  expectEqual(config.per_recipient_cap, campaignState.perRecipientCap, "per-recipient cap");
  expectEqual(config.operator, campaignState.operator, "operator");
  expectEqual(config.is_active, true, "campaign active");

  const verifierStatus = await verifierCallable({
    verifierContractId: deployment.verifierContractId,
    sourceAccount
  });
  if (verifierStatus === "unexpected_true") {
    throw new Error("Verifier unexpectedly accepted malformed proof");
  }
  console.log("[ok] verifier contract callable: malformed proof returned false");
  const verifierInfo = tryReadVerifierInfo({
    verifierContractId: deployment.verifierContractId,
    sourceAccount
  });
  if (verifierInfo) {
    console.log(`[ok] verifier_info mode: ${verifierInfo.mode}`);
    console.log(`[ok] verifier_info version: ${verifierInfo.version}`);
  } else {
    console.log("[ok] Verifier mode: legacy verifier, mode not introspectable");
  }

  console.log(
    JSON.stringify(
      {
        network: deployment.network,
        campaignContractId: deployment.campaignContractId,
        verifierContractId: deployment.verifierContractId,
        mockTokenContractId: deployment.mockTokenContractId,
        campaignId: config.campaign_id,
        complianceRoot: config.compliance_root,
        eligibilityRoot: config.eligibility_root,
        policyHash: config.policy_hash,
        verifierInfo: verifierInfo ?? {
          mode: "legacy_not_introspectable",
          notes: "Verifier mode: legacy verifier, mode not introspectable"
        },
        verifierMode: verifierInfo?.mode ?? campaignState.mode,
        stats: {
          totalClaimed: stats.total_claimed,
          claimCount: stats.claim_count,
          remainingBudget: stats.remaining_budget,
          duplicateClaimsBlocked: stats.duplicate_claims_blocked,
          invalidClaimsBlocked: stats.invalid_claims_blocked
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
