import { join } from "node:path";
import { testnetDemoRecipients } from "@lumen-aid/shared";
import { derivePayoutAccountHash } from "@lumen-aid/stellar";
import { createDemoCircuitCase } from "../circuits/claim/scripts/zk";
import {
  assetContractId,
  campaignOverride,
  classifyCampaignState,
  commandTable,
  demoTestnetPath,
  isNullifierUsed,
  latestReportsDir,
  publicDeploymentRows,
  readActiveDeployment,
  readEscrow,
  readStats,
  readVerifierInfo,
  writeDemoDeployment,
  writeMarkdownReport,
  type ContractStats,
  type ReleaseCommandResult
} from "./judge-testnet-common";
import { requireCleanSourceAccount, run, type ActiveTestnetDeployment } from "./stellar-testnet-common";

const reportPath = join(latestReportsDir, "JUDGE_DEMO_READY.md");
const demoUrl = "http://localhost:3000/demo";

async function writeReport(args: {
  overall: "READY" | "NOT READY";
  results: ReleaseCommandResult[];
  active?: ActiveTestnetDeployment;
  stats?: ContractStats;
  escrowBalance?: string;
  doraUnused?: boolean;
  error?: string;
}): Promise<void> {
  const state =
    args.stats && args.escrowBalance
      ? classifyCampaignState(args.stats, args.escrowBalance)
      : "unread";

  await writeMarkdownReport(reportPath, [
    "# Judge Demo Ready",
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    `Judge demo campaign: ${args.overall}`,
    "",
    `Demo URL: ${demoUrl}`,
    "",
    "Purpose: create a fresh AIDUSD compliance-aware campaign and leave it pristine for the judge walkthrough.",
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
    "## Demo State",
    "",
    args.stats
      ? `Campaign state: ${state}. \`claim_count=${args.stats.claim_count}\`, \`total_claimed=${args.stats.total_claimed}\`, \`remaining_budget=${args.stats.remaining_budget}\`.`
      : "Campaign stats were not readable.",
    args.doraUnused === undefined
      ? "Dora nullifier status was not readable."
      : `Dora available for valid claim: ${args.doraUnused ? "yes" : "no"}.`,
    "Eve available for non-compliant rejection: yes, based on pristine aggregate claim count and demo recipient config. No valid Eve claim status is faked.",
    "Mallory available for ineligible rejection: yes, based on pristine aggregate claim count and demo recipient config. No valid Mallory claim status is faked.",
    "",
    "## Suggested Demo Sequence",
    "",
    "1. Open `/demo`.",
    "2. Open Donor dashboard.",
    "3. Open Recipient.",
    "4. Claim as Dora.",
    "5. Try duplicate Dora.",
    "6. Try Eve non-compliant.",
    "7. Try Mallory ineligible.",
    "8. Open Donor dashboard again.",
    "9. Open Auditor disclosure.",
    "",
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
    "- Selective disclosure package is demo-only, not production view keys.",
    "",
    ...(args.error ? ["## Failure", "", args.error, ""] : []),
    `Deployment metadata written to \`${demoTestnetPath}\`. \`deployments/active-testnet.json\` is also the intended current demo state because the fresh campaign script writes the active deployment.`,
    ""
  ]);
}

function requiredRecipient(
  active: ActiveTestnetDeployment,
  id: "dora" | "eve" | "mallory"
) {
  const recipient = active.recipients.find((item) => item.id === id);
  if (!recipient) {
    throw new Error(`Demo campaign is missing recipient ${id}.`);
  }
  if (!recipient.payoutAddress) {
    throw new Error(`Demo campaign is missing payout address for ${id}.`);
  }
  return recipient;
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
    await step("pnpm", ["stellar:fresh-aidusd-campaign:testnet"], "Fresh pristine demo campaign deployed and funded.");
    await step("pnpm", ["stellar:aidusd:active:testnet"], "Fresh demo campaign is readable.");

    const active = await readActiveDeployment();
    const verifierInfo = readVerifierInfo(active, sourceAccount);
    const stats = readStats(active, sourceAccount);
    const escrowBalance = readEscrow(active, sourceAccount);
    const dora = requiredRecipient(active, "dora");
    const eve = requiredRecipient(active, "eve");
    const mallory = requiredRecipient(active, "mallory");

    if (active.assetMode !== "aidusd_sac" || active.assetCode !== "AIDUSD") {
      throw new Error(`Expected active AIDUSD SAC demo campaign, found ${active.assetMode ?? "unknown"}`);
    }
    if (!assetContractId(active)) {
      throw new Error("Demo campaign is missing AIDUSD/SAC contract.");
    }
    if (verifierInfo.mode !== "real_groth16") {
      throw new Error(`Expected real_groth16 verifier, found ${verifierInfo.mode}`);
    }
    if (!active.complianceRoot) {
      throw new Error("Demo campaign is missing complianceRoot.");
    }
    if (stats.claim_count !== 0 || stats.total_claimed !== "0") {
      throw new Error(`Demo campaign is not pristine: claim_count=${stats.claim_count}, total_claimed=${stats.total_claimed}`);
    }
    if (BigInt(escrowBalance) <= 0n) {
      throw new Error(`Demo campaign escrow is not funded: ${escrowBalance}`);
    }
    if (!dora.eligible || !dora.compliant) {
      throw new Error("Dora must be configured as eligible and compliant.");
    }
    if (!eve.eligible || eve.compliant) {
      throw new Error("Eve must be configured as eligible but non-compliant.");
    }
    if (mallory.eligible || mallory.compliant) {
      throw new Error("Mallory must be configured as ineligible and non-compliant.");
    }

    const doraCase = createDemoCircuitCase({
      recipientId: "dora",
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(active),
      amount: dora.defaultClaimAmount,
      payoutAccountHash: derivePayoutAccountHash(dora.payoutAddress)
    });
    const doraUnused = !isNullifierUsed({
      active,
      sourceAccount,
      nullifierHash: doraCase.publicInputs.nullifierHash
    });
    if (!doraUnused) {
      throw new Error("Dora nullifier is already used; demo campaign is not pristine.");
    }

    await writeDemoDeployment({
      ...active,
      purpose: "judge_demo_pristine",
      preparedAt: new Date().toISOString(),
      demoUrl,
      pristine: true,
      notes:
        "Public pristine judge demo deployment metadata. Recipient secrets, witness data, Merkle paths, and private inputs are intentionally not written here."
    });

    await writeReport({
      overall: "READY",
      results,
      active,
      stats,
      escrowBalance,
      doraUnused
    });

    console.log("✅ Pristine demo campaign created");
    console.log("✅ AIDUSD escrow funded");
    console.log("✅ Verifier mode: real_groth16");
    console.log("✅ Compliance root present");
    console.log("✅ Dora available for valid claim");
    console.log("✅ Eve available for non-compliant rejection");
    console.log("✅ Mallory available for ineligible rejection");
    console.log("✅ Demo ready at /demo");
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
      overall: "NOT READY",
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
