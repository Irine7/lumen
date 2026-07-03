import { join } from "node:path";
import {
  artifactPaths,
  assertBuildArtifactsPresent,
  assertCircuitInputs,
  buildDir,
  createDemoCircuitCase,
  nodeArgs,
  publicSignalsFromInputs,
  readJson as readZkJson,
  runCommand,
  snarkjsArgs,
  writeJson as writeZkJson
} from "../circuits/claim/scripts/zk";
import {
  campaignStatePath,
  claimPublicInputsFromNamedInputs,
  invokeContract,
  outputContainsContractError,
  readDeployment,
  readJson,
  requireCleanSourceAccount,
  strip0x,
  writeJson,
  type TestnetCampaignState
} from "./stellar-testnet-common";

const bobPublicInputsArgPath = join(
  process.cwd(),
  "deployments",
  "testnet-bob-public-inputs.arg.json"
);
const bobClaimPath = join(process.cwd(), "deployments", "testnet-bob-claim.json");
const bobInputPath = join(buildDir, "bob-input.json");
const bobNamedPublicPath = join(buildDir, "bob-public-inputs.json");
const bobWitnessPath = join(buildDir, "bob-witness.wtns");
const bobProofPath = join(buildDir, "bob-proof.json");
const bobPublicPath = join(buildDir, "bob-public.json");

function fieldToHex(value: string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

async function proofHex(path: string): Promise<string> {
  const proof = await readZkJson<{
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
  }>(path);

  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1]
  ]
    .map(fieldToHex)
    .join("");
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const deployment = await readDeployment();
  const campaignState = await readJson<TestnetCampaignState>(campaignStatePath);

  assertBuildArtifactsPresent();

  const bob = createDemoCircuitCase({ recipientId: "bob" });
  assertCircuitInputs(bob);

  if (strip0x(bob.campaign.campaignId) !== strip0x(campaignState.campaignId)) {
    throw new Error("Bob fixture campaign ID does not match deployed campaign metadata");
  }
  if (strip0x(bob.campaign.eligibilityRoot) !== strip0x(campaignState.eligibilityRoot)) {
    throw new Error("Bob fixture eligibility root does not match deployed campaign metadata");
  }
  if (strip0x(bob.campaign.complianceRoot) !== strip0x(campaignState.complianceRoot)) {
    throw new Error("Bob fixture compliance root does not match deployed campaign metadata");
  }
  if (strip0x(bob.campaign.policyHash) !== strip0x(campaignState.policyHash)) {
    throw new Error("Bob fixture policy hash does not match deployed campaign metadata");
  }

  await writeZkJson(bobInputPath, bob.circuitInputs);
  await writeZkJson(bobNamedPublicPath, bob.publicInputs);

  runCommand(
    nodeArgs([artifactPaths.witnessGenerator, artifactPaths.wasm, bobInputPath, bobWitnessPath])
  );
  runCommand(
    await snarkjsArgs([
      "groth16",
      "prove",
      artifactPaths.zkeyFinal,
      bobWitnessPath,
      bobProofPath,
      bobPublicPath
    ])
  );

  const verify = runCommand(
    await snarkjsArgs([
      "groth16",
      "verify",
      artifactPaths.verificationKey,
      bobPublicPath,
      bobProofPath
    ]),
    { allowFailure: true }
  );
  if (verify.status !== 0) {
    throw new Error("snarkjs rejected Bob's generated Groth16 proof");
  }

  const publicSignals = await readZkJson<unknown>(bobPublicPath);
  const expectedPublicSignals = publicSignalsFromInputs(bob.publicInputs);
  if (JSON.stringify(publicSignals) !== JSON.stringify(expectedPublicSignals)) {
    throw new Error("Bob public signals do not match named public inputs");
  }

  const contractPublicInputs = claimPublicInputsFromNamedInputs(bob.publicInputs);
  await writeJson(bobPublicInputsArgPath, contractPublicInputs);
  const proof = await proofHex(bobProofPath);

  const duplicateProbe = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "is_nullifier_used",
    fnArgs: ["--nullifier_hash", contractPublicInputs.nullifier_hash],
    send: "no",
    suppressOutput: true
  });
  if (/\btrue\b/.test(duplicateProbe.stdout)) {
    await writeJson(bobClaimPath, {
      network: "testnet",
      status: "blocked_already_claimed",
      campaignContractId: deployment.campaignContractId,
      verifierContractId: deployment.verifierContractId,
      nullifierHash: bob.publicInputs.nullifierHash,
      checkedAt: new Date().toISOString(),
      notes:
        "Bob's nullifier was already used before this script submitted a fresh positive claim."
    });
    console.log("[blocked] Bob nullifier is already used on testnet");
    return;
  }

  const verifierCheck = invokeContract({
    contractId: deployment.verifierContractId,
    sourceAccount,
    fn: "verify_claim",
    fnArgs: ["--public_inputs-file-path", bobPublicInputsArgPath, "--proof", proof],
    send: "no",
    suppressOutput: true
  });
  if (!/\btrue\b/.test(verifierCheck.stdout)) {
    throw new Error("On-chain verifier simulation did not accept Bob proof");
  }
  console.log("[ok] On-chain verifier simulation accepted Bob Groth16 proof");

  const claim = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "claim",
    fnArgs: ["--public_inputs-file-path", bobPublicInputsArgPath, "--proof", proof]
  });
  if (claim.status !== 0) {
    if (outputContainsContractError(claim, 10)) {
      throw new Error("Bob claim was rejected as duplicate; positive smoke test requires an unused nullifier.");
    }
    throw new Error("Bob claim failed on testnet");
  }

  await writeJson(bobClaimPath, {
    network: "testnet",
    status: "accepted",
    campaignContractId: deployment.campaignContractId,
    verifierContractId: deployment.verifierContractId,
    nullifierHash: bob.publicInputs.nullifierHash,
    amount: bob.publicInputs.amount,
    claimedAt: new Date().toISOString(),
    localCryptographicProofVerification: "real",
    onChainCryptographicProofVerification: "real",
    notes:
      "Bob proof was generated locally with snarkjs, verified locally, accepted by the deployed testnet verifier in simulation, and submitted to the campaign contract."
  });
  console.log("[ok] Bob first claim accepted on testnet");
  console.log(`[ok] wrote ${bobClaimPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
