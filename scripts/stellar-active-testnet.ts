import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  activeTestnetPath,
  invokeContract,
  readJson,
  requireCleanSourceAccount,
  strip0x,
  type ActiveTestnetDeployment
} from "./stellar-testnet-common";

interface CampaignConfig {
  asset: string;
  budget: string;
  campaign_id: string;
  eligibility_root: string;
  is_active: boolean;
  operator: string;
  per_recipient_cap: string;
  policy_hash: string;
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
  mode: "real_groth16" | "dev_verifier";
  version: string;
  verifier_id: string;
  circuit_id: string;
  verification_key_hash: string;
}

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }

  return JSON.parse(stdout.slice(start, end + 1)) as T;
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

async function verifierRejectsMalformed(args: {
  verifierContractId: string;
  sourceAccount: string;
}): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "lumen-active-testnet-"));
  const publicInputsPath = join(tempDir, "public-inputs.json");

  try {
    await writeFile(
      publicInputsPath,
      `${JSON.stringify(
        {
          amount: "1",
          amount_commitment: zeroHex32(),
          campaign_id: zeroHex32(),
          eligibility_root: zeroHex32(),
          max_amount: "1",
          nullifier_hash: zeroHex32(),
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
    if (!/\bfalse\b/.test(result.stdout)) {
      throw new Error("Verifier malformed proof simulation did not return false");
    }
    console.log("[ok] verifier contract callable: malformed proof returned false");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
  if (active.network !== "testnet") {
    throw new Error(`Expected testnet active deployment, found ${active.network}`);
  }

  const configResult = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_campaign",
    send: "no",
    suppressOutput: true
  });
  const config = parseJson<CampaignConfig>(configResult.stdout, "get_campaign");
  console.log("[ok] campaign contract callable: get_campaign");

  const statsResult = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_stats",
    send: "no",
    suppressOutput: true
  });
  const stats = parseJson<CampaignStats>(statsResult.stdout, "get_stats");
  console.log("[ok] campaign stats callable: get_stats");

  expectEqual(config.campaign_id, strip0x(active.campaignId), "active campaign ID");
  expectEqual(config.eligibility_root, strip0x(active.eligibilityRoot), "active eligibility root");
  expectEqual(config.policy_hash, strip0x(active.policyHash), "active policy hash");
  expectEqual(config.verifier, active.verifierContractId, "active verifier contract ID");
  expectEqual(config.asset, active.mockTokenContractId, "active mock token contract ID");
  expectEqual(config.budget, active.budget, "active budget");
  expectEqual(config.per_recipient_cap, active.perRecipientCap, "active per-recipient cap");
  expectEqual(config.is_active, true, "active campaign active");

  const verifierInfoResult = invokeContract({
    contractId: active.verifierContractId,
    sourceAccount,
    fn: "verifier_info",
    allowFailure: true,
    send: "no",
    suppressOutput: true
  });

  let verifierInfo: VerifierInfo | { mode: "legacy_not_introspectable"; notes: string };
  if (verifierInfoResult.status === 0) {
    verifierInfo = parseJson<VerifierInfo>(verifierInfoResult.stdout, "verifier_info");
    console.log(`[ok] verifier info readable: ${verifierInfo.mode}`);
  } else {
    verifierInfo = {
      mode: "legacy_not_introspectable",
      notes: "Verifier mode: legacy verifier, mode not introspectable"
    };
    console.log("[ok] Verifier mode: legacy verifier, mode not introspectable");
  }

  await verifierRejectsMalformed({
    verifierContractId: active.verifierContractId,
    sourceAccount
  });

  console.log(
    JSON.stringify(
      {
        activeCampaign: active,
        verifierInfo,
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

