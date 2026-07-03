import {
  artifactPaths,
  assertBuildArtifactsPresent,
  assertCircuitInputs,
  createDemoCircuitCase,
  createMalloryWithAlicePathCase,
  nodeArgs,
  readJson,
  runCommand,
  snarkjsArgs,
  tamperPublicSignals,
  writeJson,
  type VerificationCaseResult
} from "./zk";

async function verifyProof(
  publicPath: string,
  proofPath: string,
  options: { suppressOutput?: boolean } = {}
): Promise<boolean> {
  const result = runCommand(
    await snarkjsArgs([
      "groth16",
      "verify",
      artifactPaths.verificationKey,
      publicPath,
      proofPath
    ]),
    { allowFailure: true, suppressOutput: options.suppressOutput }
  );

  return result.status === 0 && /\bOK\b|OK!/i.test(result.stdout);
}

function witnessCommand(inputPath: string, witnessPath: string) {
  return nodeArgs([
    artifactPaths.witnessGenerator,
    artifactPaths.wasm,
    inputPath,
    witnessPath
  ]);
}

async function invalidWitnessCase(
  name: string,
  inputPath: string,
  witnessPath: string
): Promise<VerificationCaseResult> {
  const result = runCommand(witnessCommand(inputPath, witnessPath), {
    allowFailure: true,
    suppressOutput: true
  });
  const actual = result.status === 0;

  return {
    name,
    expected: false,
    actual,
    ok: actual === false,
    detail: actual
      ? "invalid witness generation unexpectedly succeeded"
      : "invalid witness generation failed as expected"
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main(): Promise<void> {
  assertBuildArtifactsPresent();

  if (!(await verifyProof(artifactPaths.alicePublic, artifactPaths.aliceProof))) {
    console.log("Alice proof artifacts missing or stale; regenerating with pnpm zk:prove:demo.");
    runCommand({ command: "pnpm", args: ["zk:prove:demo"], shell: true });
  }

  const results: VerificationCaseResult[] = [];

  const aliceValid = await verifyProof(artifactPaths.alicePublic, artifactPaths.aliceProof);
  results.push({
    name: "Alice valid proof passes",
    expected: true,
    actual: aliceValid,
    ok: aliceValid === true,
    detail: "snarkjs groth16 verify against Alice proof/public signals"
  });

  const mallory = createMalloryWithAlicePathCase();
  assertCircuitInputs(mallory);
  const malloryInputPath = artifactPaths.aliceInput.replace(
    "alice-input.json",
    "mallory-input.invalid.json"
  );
  const malloryWitnessPath = artifactPaths.aliceWitness.replace(
    "alice-witness.wtns",
    "mallory-witness.invalid.wtns"
  );
  await writeJson(malloryInputPath, mallory.circuitInputs);
  results.push(
    await invalidWitnessCase("Mallory invalid claim fails", malloryInputPath, malloryWitnessPath)
  );

  const eveWithWrongCompliance = createDemoCircuitCase({
    recipientId: "eve",
    complianceMerkleProofOverride: createDemoCircuitCase({ recipientId: "alice" })
      .complianceMerkleProof
  });
  assertCircuitInputs(eveWithWrongCompliance);
  const eveInputPath = artifactPaths.aliceInput.replace(
    "alice-input.json",
    "eve-non-compliant-input.invalid.json"
  );
  const eveWitnessPath = artifactPaths.aliceWitness.replace(
    "alice-witness.wtns",
    "eve-non-compliant-witness.invalid.wtns"
  );
  await writeJson(eveInputPath, eveWithWrongCompliance.circuitInputs);
  results.push(
    await invalidWitnessCase("Eligible but not compliant recipient fails", eveInputPath, eveWitnessPath)
  );

  const malloryCompliantRecipients = mallory.tree.eligibleRecipients
    .concat(mallory.recipient)
    .map((recipient) =>
      recipient.id === "mallory" ? { ...recipient, eligible: false, compliant: true } : recipient
    );
  const compliantMallory = createDemoCircuitCase({
    recipientId: "mallory",
    recipients: malloryCompliantRecipients,
    merkleProofOverride: createDemoCircuitCase({ recipientId: "alice" }).merkleProof
  });
  assertCircuitInputs(compliantMallory);
  const compliantMalloryInputPath = artifactPaths.aliceInput.replace(
    "alice-input.json",
    "compliant-mallory-input.invalid.json"
  );
  const compliantMalloryWitnessPath = artifactPaths.aliceWitness.replace(
    "alice-witness.wtns",
    "compliant-mallory-witness.invalid.wtns"
  );
  await writeJson(compliantMalloryInputPath, compliantMallory.circuitInputs);
  results.push(
    await invalidWitnessCase(
      "Compliant but not eligible recipient fails",
      compliantMalloryInputPath,
      compliantMalloryWitnessPath
    )
  );

  const bobCompliancePath = createDemoCircuitCase({ recipientId: "bob" }).complianceMerkleProof;
  const tamperedCompliancePath = createDemoCircuitCase({
    recipientId: "alice",
    complianceMerkleProofOverride: bobCompliancePath
  });
  assertCircuitInputs(tamperedCompliancePath);
  const tamperedComplianceInputPath = artifactPaths.aliceInput.replace(
    "alice-input.json",
    "tampered-compliance-path-input.invalid.json"
  );
  const tamperedComplianceWitnessPath = artifactPaths.aliceWitness.replace(
    "alice-witness.wtns",
    "tampered-compliance-path-witness.invalid.wtns"
  );
  await writeJson(tamperedComplianceInputPath, tamperedCompliancePath.circuitInputs);
  results.push(
    await invalidWitnessCase(
      "Tampered compliance path fails",
      tamperedComplianceInputPath,
      tamperedComplianceWitnessPath
    )
  );

  const overCap = createDemoCircuitCase({
    recipientId: "alice",
    amount: mallory.campaign.perRecipientCap + 1
  });
  assertCircuitInputs(overCap);
  const overCapInputPath = artifactPaths.aliceInput.replace(
    "alice-input.json",
    "over-cap-input.invalid.json"
  );
  const overCapWitnessPath = artifactPaths.aliceWitness.replace(
    "alice-witness.wtns",
    "over-cap-witness.invalid.wtns"
  );
  await writeJson(overCapInputPath, overCap.circuitInputs);
  results.push(
    await invalidWitnessCase("Over-cap amount fails", overCapInputPath, overCapWitnessPath)
  );

  const publicSignals = await readJson<string[]>(artifactPaths.alicePublic);
  if (!Array.isArray(publicSignals)) {
    throw new Error("Alice public signals file is not an array");
  }

  const modifiedPublicPath = artifactPaths.alicePublic.replace(
    "alice-public.json",
    "tampered-public.invalid.json"
  );
  await writeJson(modifiedPublicPath, tamperPublicSignals(publicSignals, 4));
  const modifiedPublic = await verifyProof(modifiedPublicPath, artifactPaths.aliceProof, {
    suppressOutput: true
  });
  results.push({
    name: "Modified public input does not verify",
    expected: false,
    actual: modifiedPublic,
    ok: modifiedPublic === false,
    detail: "nullifier public signal changed"
  });

  const wrongRootPath = artifactPaths.alicePublic.replace(
    "alice-public.json",
    "wrong-root-public.invalid.json"
  );
  await writeJson(wrongRootPath, tamperPublicSignals(publicSignals, 1));
  const wrongRoot = await verifyProof(wrongRootPath, artifactPaths.aliceProof, {
    suppressOutput: true
  });
  results.push({
    name: "Wrong eligibility root fails",
    expected: false,
    actual: wrongRoot,
    ok: wrongRoot === false,
    detail: "eligibility_root public signal changed"
  });

  const wrongComplianceRootPath = artifactPaths.alicePublic.replace(
    "alice-public.json",
    "wrong-compliance-root-public.invalid.json"
  );
  await writeJson(wrongComplianceRootPath, tamperPublicSignals(publicSignals, 2));
  const wrongComplianceRoot = await verifyProof(wrongComplianceRootPath, artifactPaths.aliceProof, {
    suppressOutput: true
  });
  results.push({
    name: "Tampered compliance root fails",
    expected: false,
    actual: wrongComplianceRoot,
    ok: wrongComplianceRoot === false,
    detail: "compliance_root public signal changed"
  });

  const wrongCampaignPath = artifactPaths.alicePublic.replace(
    "alice-public.json",
    "wrong-campaign-public.invalid.json"
  );
  await writeJson(wrongCampaignPath, tamperPublicSignals(publicSignals, 0));
  const wrongCampaign = await verifyProof(wrongCampaignPath, artifactPaths.aliceProof, {
    suppressOutput: true
  });
  results.push({
    name: "Wrong campaign_id fails",
    expected: false,
    actual: wrongCampaign,
    ok: wrongCampaign === false,
    detail: "campaign_id public signal changed"
  });

  const wrongPolicyPath = artifactPaths.alicePublic.replace(
    "alice-public.json",
    "wrong-policy-public.invalid.json"
  );
  await writeJson(wrongPolicyPath, tamperPublicSignals(publicSignals, 3));
  const wrongPolicy = await verifyProof(wrongPolicyPath, artifactPaths.aliceProof, {
    suppressOutput: true
  });
  results.push({
    name: "Wrong compliance policy/provider fails",
    expected: false,
    actual: wrongPolicy,
    ok: wrongPolicy === false,
    detail: "policy_hash public signal changed"
  });

  const proof = await readJson<Record<string, unknown>>(artifactPaths.aliceProof);
  const tamperedProof = cloneJson(proof);
  const piA = tamperedProof.pi_a;
  if (!Array.isArray(piA) || typeof piA[0] !== "string") {
    throw new Error("Unexpected Groth16 proof shape: pi_a missing");
  }
  piA[0] = piA[0] === "1" ? "2" : "1";
  const tamperedProofPath = artifactPaths.aliceProof.replace(
    "alice-proof.json",
    "tampered-proof.invalid.json"
  );
  await writeJson(tamperedProofPath, tamperedProof);
  const tamperedProofResult = await verifyProof(artifactPaths.alicePublic, tamperedProofPath, {
    suppressOutput: true
  });
  results.push({
    name: "Modified proof does not verify",
    expected: false,
    actual: tamperedProofResult,
    ok: tamperedProofResult === false,
    detail: "proof pi_a[0] changed"
  });

  const pass = results.every((result) => result.ok);
  await writeJson(artifactPaths.verificationReport, {
    proofSystem: "Groth16",
    verifierMode: "real_local",
    pass,
    results
  });

  for (const result of results) {
    console.log(
      `${result.ok ? "[ok]" : "[fail]"} ${result.name}: expected ${result.expected}, actual ${result.actual} (${result.detail})`
    );
  }

  console.log("Proof system: Groth16");
  console.log("Circuit: circuits/claim/claim.circom");
  console.log("Verifier mode: real_local");

  if (!pass) {
    throw new Error("Local Groth16 verification suite failed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
