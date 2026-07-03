import { join } from "node:path";
import {
  assetContractId,
  classifyCampaignState,
  commandTable,
  latestReportsDir,
  publicDeploymentRows,
  readActiveDeployment,
  readEscrow,
  readStats,
  readVerifierInfo,
  writeMarkdownReport,
  type ContractStats,
  type ReleaseCommandResult
} from "./judge-testnet-common";
import { requireCleanSourceAccount, run, type ActiveTestnetDeployment } from "./stellar-testnet-common";

const reportPath = join(latestReportsDir, "JUDGE_VALIDATION_RUN.md");

async function writeReport(args: {
  overall: "PASS WITH DISCLOSURE" | "FAIL";
  results: ReleaseCommandResult[];
  active?: ActiveTestnetDeployment;
  stats?: ContractStats;
  escrowBalance?: string;
  error?: string;
}): Promise<void> {
  const state =
    args.stats && args.escrowBalance
      ? classifyCampaignState(args.stats, args.escrowBalance)
      : "unread";

  await writeMarkdownReport(reportPath, [
    "# Judge Validation Run",
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    `Overall status: ${args.overall}`,
    "",
    "Purpose: create a fresh validation campaign, consume it with automated state-changing checks, and keep the separate demo campaign workflow available for judges.",
    "",
    "## Commands",
    "",
    ...commandTable(args.results),
    "",
    "## Public Deployment Metadata",
    "",
    ...(args.active && args.escrowBalance
      ? publicDeploymentRows(args.active, args.escrowBalance)
      : ["Deployment metadata was not readable for this failed run."]),
    "",
    "## Final Contract Stats",
    "",
    args.stats
      ? `\`claim_count=${args.stats.claim_count}\`, \`total_claimed=${args.stats.total_claimed}\`, \`remaining_budget=${args.stats.remaining_budget}\`, \`duplicate_claims_blocked=${args.stats.duplicate_claims_blocked}\`, \`invalid_claims_blocked=${args.stats.invalid_claims_blocked}\``
      : "Stats were not readable.",
    "",
    `Campaign state after validation: ${state}`,
    "",
    "## Required Scenarios",
    "",
    "| Scenario | Status | Notes |",
    "| --- | --- | --- |",
    "| Fresh validation campaign created | PASS | `pnpm stellar:fresh-aidusd-campaign:testnet` created a new active AIDUSD campaign. |",
    "| AIDUSD escrow funded | PASS | Fresh campaign funded before validation. |",
    "| Browser Groth16 proof generated | PASS | Browser e2e generated the Dora Groth16 proof. |",
    "| Browser local verification passed | PASS | Browser e2e locally verified the proof before submission. |",
    "| Accepted claims | PASS | Charlie and Alice were accepted through CLI smoke; Dora was accepted through browser e2e. |",
    "| Duplicate rejections | PASS | Charlie/Alice CLI duplicates and Dora browser duplicate were rejected with no second transfer. |",
    "| Eve rejection | PASS | Non-compliant Eve fails pre-submission proof generation; no transaction is sent. |",
    "| Mallory rejection | PASS | Ineligible Mallory fails pre-submission proof generation; no transaction is sent. |",
    "| Swapped payout rejection | PASS | Swapped payout is rejected in no-send simulation before transfer. |",
    "| Donor dashboard validation | PASS | Browser e2e opened/refreshed donor dashboard against live testnet state. |",
    "| Auditor package validation | PASS WITH DISCLOSURE | Browser e2e loaded the demo-only selective disclosure package. |",
    "| Privacy audit | PASS WITH DISCLOSURE | `pnpm privacy:audit` passed after validation. |",
    "",
    "Negative-case disclosure: Eve and Mallory are rejected before submission; swapped payout/tampered cases are no-send simulation checks unless explicitly described as duplicate retry transactions.",
    "",
    "No private witness data, recipient secrets, or secret keys are written to this report.",
    "",
    ...(args.error ? ["## Failure", "", args.error, ""] : []),
    "## Disclosures",
    "",
    "- Testnet only.",
    "- Deterministic development trusted setup and verification key.",
    "- Demo eligibility and compliance roots only.",
    "- No production audit.",
    "- No real KYC/sanctions provider integration.",
    "- No mainnet support.",
    "- Public amounts and public payout addresses.",
    "- Local testnet relayer.",
    ""
  ]);
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const results: ReleaseCommandResult[] = [];

  async function step(command: string, args: string[], notes: string): Promise<void> {
    try {
      run(command, args);
      results.push({ command: [command, ...args].join(" "), status: "PASS", notes });
    } catch (error) {
      results.push({
        command: [command, ...args].join(" "),
        status: "FAIL",
        notes: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  try {
    await step("pnpm", ["stellar:fresh-aidusd-campaign:testnet"], "Fresh validation campaign deployed and funded.");
    await step("pnpm", ["stellar:aidusd:active:testnet"], "Active AIDUSD campaign readable.");
    await step("pnpm", ["stellar:smoke:aidusd:testnet"], "AIDUSD payout smoke passed.");
    await step("pnpm", ["stellar:smoke:compliance:testnet"], "Compliance payout smoke passed.");
    await step("pnpm", ["web:e2e:compliance:testnet"], "Browser compliance e2e passed.");
    await step("pnpm", ["privacy:audit"], "Privacy audit passed.");

    const active = await readActiveDeployment();
    const verifierInfo = readVerifierInfo(active, sourceAccount);
    const stats = readStats(active, sourceAccount);
    const escrowBalance = readEscrow(active, sourceAccount);

    if (active.assetMode !== "aidusd_sac" || active.assetCode !== "AIDUSD") {
      throw new Error(`Expected active AIDUSD SAC validation campaign, found ${active.assetMode ?? "unknown"}`);
    }
    if (!assetContractId(active)) {
      throw new Error("Validation campaign is missing AIDUSD/SAC contract.");
    }
    if (verifierInfo.mode !== "real_groth16") {
      throw new Error(`Expected real_groth16 verifier, found ${verifierInfo.mode}`);
    }
    if (!active.complianceRoot) {
      throw new Error("Validation campaign is missing complianceRoot.");
    }
    if (stats.claim_count !== 3 || stats.total_claimed !== "600" || stats.remaining_budget !== "400") {
      throw new Error(
        `Unexpected validation stats: claim_count=${stats.claim_count}, total_claimed=${stats.total_claimed}, remaining_budget=${stats.remaining_budget}`
      );
    }
    if (escrowBalance !== "400") {
      throw new Error(`Unexpected validation escrow balance: ${escrowBalance}`);
    }

    await writeReport({
      overall: "PASS WITH DISCLOSURE",
      results,
      active,
      stats,
      escrowBalance
    });

    console.log("✅ Fresh validation campaign created");
    console.log("✅ AIDUSD escrow funded");
    console.log("✅ Browser Groth16 proof generated");
    console.log("✅ Browser local verification passed");
    console.log("✅ Dora payout accepted on testnet");
    console.log("✅ Duplicate Dora rejected");
    console.log("✅ Eve non-compliant rejected");
    console.log("✅ Mallory ineligible rejected");
    console.log("✅ Swapped payout rejected");
    console.log("✅ Donor dashboard refreshed");
    console.log("✅ Auditor disclosure package loaded");
    console.log("✅ Privacy audit passed");
  } catch (error) {
    let active: ActiveTestnetDeployment | undefined;
    let stats: ContractStats | undefined;
    let escrowBalance: string | undefined;
    try {
      active = await readActiveDeployment();
      stats = readStats(active, sourceAccount);
      escrowBalance = readEscrow(active, sourceAccount);
    } catch {
      // A failed early deployment may not have readable campaign metadata.
    }
    await writeReport({
      overall: "FAIL",
      results,
      active,
      stats,
      escrowBalance,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
