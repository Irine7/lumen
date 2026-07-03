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

function ok(message: string): void {
  console.log(`✅ ${message}`);
}

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }

  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function parseInteger(stdout: string, label: string): string {
  const match = stdout.match(/-?\d+/);
  if (!match) {
    throw new Error(`Could not parse integer from ${label}`);
  }
  return match[0];
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

function tokenBalance(args: {
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
  return parseInteger(result.stdout, "asset balance");
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
  if (active.network !== "testnet") {
    throw new Error(`Expected testnet active deployment, found ${active.network}`);
  }
  const assetContractId = active.assetContractId ?? active.mockTokenContractId;
  if (!assetContractId) {
    throw new Error("Active payout campaign does not include an assetContractId");
  }

  const configResult = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_campaign",
    send: "no",
    suppressOutput: true
  });
  const config = parseJson<CampaignConfig>(configResult.stdout, "get_campaign");
  expectEqual(config.campaign_id, strip0x(active.campaignId), "campaign ID");
  expectEqual(config.eligibility_root, strip0x(active.eligibilityRoot), "eligibility root");
  expectEqual(config.policy_hash, strip0x(active.policyHash), "policy hash");
  expectEqual(config.verifier, active.verifierContractId, "verifier");
  expectEqual(config.asset, assetContractId, "asset contract");
  expectEqual(config.is_active, true, "active flag");
  ok("campaign callable");

  const verifierInfoResult = invokeContract({
    contractId: active.verifierContractId,
    sourceAccount,
    fn: "verifier_info",
    send: "no",
    suppressOutput: true
  });
  const verifierInfo = parseJson<VerifierInfo>(verifierInfoResult.stdout, "verifier_info");
  if (verifierInfo.mode !== "real_groth16") {
    throw new Error(`Expected real_groth16 verifier, found ${verifierInfo.mode}`);
  }
  ok(`Verifier mode: ${verifierInfo.mode}`);

  const statsResult = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_stats",
    send: "no",
    suppressOutput: true
  });
  const stats = parseJson<CampaignStats>(statsResult.stdout, "get_stats");
  ok("campaign stats readable");

  const escrowResult = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_escrow_balance",
    send: "no",
    suppressOutput: true
  });
  const escrowBalance = parseInteger(escrowResult.stdout, "get_escrow_balance");
  ok(`escrow balance readable: ${escrowBalance}`);

  const tokenEscrow = tokenBalance({
    assetContractId,
    sourceAccount,
    id: active.campaignContractId
  });
  ok(`asset contract callable: escrow token balance ${tokenEscrow}`);

  const recipientBalances = active.recipients
    .filter((recipient) => recipient.payoutAddress)
    .map((recipient) => ({
      id: recipient.id,
      payoutAddress: recipient.payoutAddress!,
      balance: tokenBalance({
        assetContractId,
        sourceAccount,
        id: recipient.payoutAddress!
      })
    }));
  ok(`recipient balances readable: ${recipientBalances.length}`);

  console.log(
    JSON.stringify(
      {
        activeCampaign: {
          campaignContractId: active.campaignContractId,
          verifierContractId: active.verifierContractId,
          assetContractId,
          assetCode: active.assetCode ?? "unknown",
          campaignId: active.campaignId,
          budget: active.budget,
          escrowFunded: active.escrowFunded,
          perRecipientCap: active.perRecipientCap
        },
        verifierInfo,
        stats: {
          totalClaimed: stats.total_claimed,
          claimCount: stats.claim_count,
          remainingBudget: stats.remaining_budget,
          duplicateClaimsBlocked: stats.duplicate_claims_blocked,
          invalidClaimsBlocked: stats.invalid_claims_blocked
        },
        escrowBalance,
        tokenEscrow,
        recipientBalances
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
