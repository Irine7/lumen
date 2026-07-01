import {
  artifactPaths,
  assertBuildArtifactsPresent,
  assertCircuitInputs,
  buildDir,
  createDemoCircuitCase,
  nodeArgs,
  publicSignalsFromInputs,
  readJson,
  runCommand,
  snarkjsArgs,
  writeDemoMetadata,
  writeJson
} from "./zk";

async function main(): Promise<void> {
  assertBuildArtifactsPresent();

  const alice = createDemoCircuitCase({ recipientId: "alice" });
  assertCircuitInputs(alice);

  await writeDemoMetadata(alice);
  await writeJson(artifactPaths.aliceInput, alice.circuitInputs);
  await writeJson(artifactPaths.aliceNamedPublic, alice.publicInputs);
  await writeJson(artifactPaths.alicePrivateDebug, alice.privateInputs);

  runCommand(
    nodeArgs([
      artifactPaths.witnessGenerator,
      artifactPaths.wasm,
      artifactPaths.aliceInput,
      artifactPaths.aliceWitness
    ])
  );
  runCommand(
    await snarkjsArgs([
      "groth16",
      "prove",
      artifactPaths.zkeyFinal,
      artifactPaths.aliceWitness,
      artifactPaths.aliceProof,
      artifactPaths.alicePublic
    ])
  );

  const verify = runCommand(
    await snarkjsArgs([
      "groth16",
      "verify",
      artifactPaths.verificationKey,
      artifactPaths.alicePublic,
      artifactPaths.aliceProof
    ]),
    { allowFailure: true }
  );
  const localVerification = verify.status === 0;

  if (!localVerification) {
    throw new Error("snarkjs rejected Alice's generated Groth16 proof");
  }

  const proofJson = await readJson<unknown>(artifactPaths.aliceProof);
  const publicJson = await readJson<unknown>(artifactPaths.alicePublic);
  await writeJson(artifactPaths.proof, proofJson);
  await writeJson(artifactPaths.public, publicJson);

  const expectedPublicSignals = publicSignalsFromInputs(alice.publicInputs);
  await writeJson(artifactPaths.proofSummary, {
    proofSystem: "Groth16",
    circuit: "circuits/claim/claim.circom",
    proofGenerated: true,
    localVerification,
    verifierMode: "real_local",
    trustedSetup: "deterministic_development_only",
    publicSignalsMatchNamedInputs:
      JSON.stringify(publicJson) === JSON.stringify(expectedPublicSignals),
    artifacts: {
      proof: artifactPaths.aliceProof,
      publicSignals: artifactPaths.alicePublic,
      witness: artifactPaths.aliceWitness,
      verificationKey: artifactPaths.verificationKey
    }
  });

  console.log(`Demo proof artifacts generated in ${buildDir}`);
  console.log("Proof system: Groth16");
  console.log("Circuit: circuits/claim/claim.circom");
  console.log("Proof generated: true");
  console.log("Local verification: true");
  console.log("Verifier mode: real_local");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
