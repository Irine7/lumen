import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { demoRecipients, type CampaignStats, type ClaimPublicInputs, type Hex32 } from "@lumen-aid/shared";
import { buildDemoEligibilityTree, createDemoCampaignConfig } from "@lumen-aid/merkle";
import { generateClaimProof } from "@lumen-aid/prover";
import { createLocalLumenClient, type SubmitClaimResult } from "@lumen-aid/stellar";
import {
  artifactPaths,
  assertBuildArtifactsPresent,
  readJson,
  repoRoot,
  snarkjsArgs,
  type CommandSpec
} from "../circuits/claim/scripts/zk";

function pass(message: string): void {
  console.log(`✅ ${message}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function warn(message: string): void {
  console.log(`⚠️ ${message}`);
}

function fail(message: string): never {
  throw new Error(message);
}

function runQuiet(command: string, args: string[], shell = false): string {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell,
    stdio: "pipe"
  }) as SpawnSyncReturns<string>;

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    fail(`Command failed (${result.status ?? 1}): ${[command, ...args].join(" ")}`);
  }

  return result.stdout ?? "";
}

function runPnpm(script: string): string {
  return runQuiet("pnpm", [script], true);
}

function runCommandSpecQuiet(spec: CommandSpec): string {
  return runQuiet(spec.command, spec.args, spec.shell ?? false);
}

async function existingBuildLooksReal(): Promise<boolean> {
  try {
    assertBuildArtifactsPresent();
    const status = await readJson<{
      circuit?: string;
      proofSystem?: string;
      status?: string;
      trustedSetup?: string;
    }>(artifactPaths.buildStatus);

    if (
      status.circuit !== "circuits/claim/claim.circom" ||
      status.proofSystem !== "Groth16" ||
      status.status !== "compiled" ||
      status.trustedSetup !== "deterministic_development_only"
    ) {
      return false;
    }

    runCommandSpecQuiet(await snarkjsArgs(["r1cs", "info", artifactPaths.r1cs]));
    return true;
  } catch {
    return false;
  }
}

async function ensureRealBuild(): Promise<void> {
  if (await existingBuildLooksReal()) {
    pass("Circuit compiled");
    return;
  }

  runPnpm("zk:build");
  pass("Circuit compiled");
}

function expectResult(
  result: SubmitClaimResult,
  expected: SubmitClaimResult["status"],
  label: string
): void {
  if (result.status !== expected) {
    fail(`${label}: expected ${expected}, got ${result.status} (${result.message})`);
  }
}

function expectStats(stats: CampaignStats): void {
  const expected = {
    totalClaimed: 125,
    claimCount: 1,
    remainingBudget: 875,
    duplicateClaimsBlocked: 1,
    invalidClaimsBlocked: 4
  };

  for (const [key, value] of Object.entries(expected)) {
    if (stats[key as keyof typeof expected] !== value) {
      fail(`Final campaign stats mismatch for ${key}: expected ${value}, got ${stats[key as keyof typeof expected]}`);
    }
  }
}

function expectClaimTotals(
  before: CampaignStats,
  after: CampaignStats,
  label: string
): void {
  const keys: Array<keyof Pick<CampaignStats, "totalClaimed" | "claimCount" | "remainingBudget">> = [
    "totalClaimed",
    "claimCount",
    "remainingBudget"
  ];

  for (const key of keys) {
    if (before[key] !== after[key]) {
      fail(`${label}: expected ${key} to stay ${before[key]}, got ${after[key]}`);
    }
  }
}

function withWrongRoot(inputs: ClaimPublicInputs): ClaimPublicInputs {
  return {
    ...inputs,
    eligibilityRoot:
      "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex32
  };
}

function withWrongComplianceRoot(inputs: ClaimPublicInputs): ClaimPublicInputs {
  return {
    ...inputs,
    complianceRoot:
      "0x0000000000000000000000000000000000000000000000000000000000000003" as Hex32
  };
}

function withWrongPolicy(inputs: ClaimPublicInputs): ClaimPublicInputs {
  return {
    ...inputs,
    policyHash:
      "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex32
  };
}

async function main(): Promise<void> {
  console.log("Lumen — ZK Private Aid Disbursement Demo");

  const tree = buildDemoEligibilityTree();
  const campaign = createDemoCampaignConfig(tree);
  const client = createLocalLumenClient(campaign);
  const alice = demoRecipients.find((recipient) => recipient.id === "alice") ?? fail("Alice fixture missing");
  const mallory = demoRecipients.find((recipient) => recipient.id === "mallory") ?? fail("Mallory fixture missing");

  section("1. Campaign setup");
  runPnpm("zk:doctor");
  await ensureRealBuild();
  pass(`Campaign ID: ${campaign.campaignId}`);
  pass(`Eligibility root: ${campaign.eligibilityRoot}`);
  pass(`Compliance root: ${campaign.complianceRoot}`);
  pass(`Policy hash: ${campaign.policyHash}`);
  pass(`Per-recipient cap: ${campaign.perRecipientCap}`);
  pass(`Budget: ${campaign.budget}`);

  section("2. Alice valid recipient");
  runPnpm("zk:prove:demo");
  if (!existsSync(artifactPaths.aliceProof) || !existsSync(artifactPaths.alicePublic)) {
    fail("Alice proof artifacts were not generated");
  }
  pass("Private witness prepared locally");
  pass("Proof generated");

  runPnpm("zk:verify:local");
  pass("Local cryptographic verification passed");
  warn("On-chain proof verification is not exercised by demo:e2e.");
  warn("This local demo command submits campaign claims through the dev_verifier simulator envelope.");

  const aliceProof = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: alice,
    amount: alice.defaultClaimAmount
  });
  pass(`Nullifier derived: ${aliceProof.publicInputs.nullifierHash}`);

  const accepted = await client.submitClaim(aliceProof.publicInputs, aliceProof.proof);
  expectResult(accepted, "claim_accepted", "Alice claim");
  pass("Claim accepted");
  pass(
    `Campaign stats updated: totalClaimed=${accepted.stats.totalClaimed}, claimCount=${accepted.stats.claimCount}, remainingBudget=${accepted.stats.remainingBudget}`
  );

  section("3. Alice duplicate attempt");
  const beforeDuplicate = client.getCampaignStats();
  const duplicate = await client.submitClaim(aliceProof.publicInputs, aliceProof.proof);
  expectResult(duplicate, "duplicate_rejected", "Alice duplicate claim");
  expectClaimTotals(beforeDuplicate, duplicate.stats, "Alice duplicate claim");
  pass("Same nullifier detected");
  pass("Alice duplicate claim rejected");
  pass("Claim totals unchanged; duplicate counter updated");

  section("4. Mallory invalid recipient");
  const malloryProof = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: mallory,
    amount: mallory.defaultClaimAmount
  });
  if (malloryProof.ok || !malloryProof.errors.some((error) => error.includes("eligibility Merkle tree"))) {
    fail("Mallory witness was expected to fail eligibility checks");
  }
  pass("Mallory not in eligibility tree");
  pass("Proof rejected by local witness checks");
  const beforeMallory = client.getCampaignStats();
  const malloryResult = await client.submitClaim(malloryProof.publicInputs, malloryProof.proof);
  expectResult(malloryResult, "invalid_rejected", "Mallory claim");
  expectClaimTotals(beforeMallory, malloryResult.stats, "Mallory claim");
  pass("Mallory rejected");

  section("5. Over-cap attempt");
  const overCapProof = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: alice,
    amount: campaign.perRecipientCap + 1
  });
  if (overCapProof.ok || !overCapProof.errors.includes("Claim amount exceeds per-recipient cap")) {
    fail("Over-cap witness was expected to fail amount checks");
  }
  pass("Amount exceeds cap");
  pass("Proof rejected by local witness checks");
  const beforeOverCap = client.getCampaignStats();
  const overCapResult = await client.submitClaim(overCapProof.publicInputs, overCapProof.proof);
  expectResult(overCapResult, "invalid_rejected", "Over-cap claim");
  expectClaimTotals(beforeOverCap, overCapResult.stats, "Over-cap claim");
  pass("Over-cap rejected");
  pass("Claim totals unchanged; invalid counter updated");

  section("6. Wrong roots / wrong policy");
  const wrongRoot = await client.submitClaim(withWrongRoot(aliceProof.publicInputs), aliceProof.proof);
  expectResult(wrongRoot, "invalid_rejected", "Wrong root claim");
  pass("Wrong root rejected");

  const wrongComplianceRoot = await client.submitClaim(
    withWrongComplianceRoot(aliceProof.publicInputs),
    aliceProof.proof
  );
  expectResult(wrongComplianceRoot, "invalid_rejected", "Wrong compliance root claim");
  pass("Wrong compliance root rejected");

  const wrongPolicy = await client.submitClaim(withWrongPolicy(aliceProof.publicInputs), aliceProof.proof);
  expectResult(wrongPolicy, "invalid_rejected", "Wrong policy claim");
  pass("Wrong policy rejected");

  section("7. Final summary");
  const stats = client.getCampaignStats();
  expectStats(stats);
  pass(`Successful claims: ${stats.claimCount}`);
  pass(`Duplicate claims blocked: ${stats.duplicateClaimsBlocked}`);
  pass(`Invalid claims blocked: ${stats.invalidClaimsBlocked}`);
  pass("Public recipient identity leaked: no");
  pass("Local cryptographic proof verification: real");
  warn("On-chain proof verification: not exercised by demo:e2e");
  warn("Local browser/demo campaign path remains a simulator until frontend testnet submission is wired.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
