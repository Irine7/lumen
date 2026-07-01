import {
  artifactPaths,
  buildDir,
  claimCircuitPath,
  cleanBuildDir,
  ensureBuildDir,
  requireCircom,
  requireSnarkjs,
  type CommandSpec,
  runCommand,
  snarkjsArgs,
  writeJson
} from "./zk";

const PTAU_POWER = "12";
const PTAU_CURVE = "bn128";
const PTAU_BEACON =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const ZKEY_BEACON =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

async function compileCircuit(circom: CommandSpec): Promise<void> {
  runCommand({
    command: circom.command,
    args: [
      ...circom.args,
      claimCircuitPath,
      "--r1cs",
      "--wasm",
      "--sym",
      "-o",
      buildDir
    ],
    shell: circom.shell
  });
}

async function runTrustedSetup(): Promise<void> {
  runCommand(
    await snarkjsArgs([
      "powersoftau",
      "new",
      PTAU_CURVE,
      PTAU_POWER,
      artifactPaths.pot0
    ])
  );
  runCommand(
    await snarkjsArgs([
      "powersoftau",
      "beacon",
      artifactPaths.pot0,
      artifactPaths.potBeacon,
      PTAU_BEACON,
      "10",
      "--name=Lumen deterministic development beacon"
    ])
  );
  runCommand(
    await snarkjsArgs([
      "powersoftau",
      "prepare",
      "phase2",
      artifactPaths.potBeacon,
      artifactPaths.potFinal
    ])
  );
  runCommand(
    await snarkjsArgs([
      "groth16",
      "setup",
      artifactPaths.r1cs,
      artifactPaths.potFinal,
      artifactPaths.zkey0
    ])
  );
  runCommand(
    await snarkjsArgs([
      "zkey",
      "beacon",
      artifactPaths.zkey0,
      artifactPaths.zkeyFinal,
      ZKEY_BEACON,
      "10",
      "--name=Lumen deterministic development zkey beacon"
    ])
  );
  runCommand(
    await snarkjsArgs([
      "zkey",
      "export",
      "verificationkey",
      artifactPaths.zkeyFinal,
      artifactPaths.verificationKey
    ])
  );
}

async function main(): Promise<void> {
  const circom = await requireCircom();
  await requireSnarkjs();

  await cleanBuildDir();
  await ensureBuildDir();

  await compileCircuit(circom);
  runCommand(await snarkjsArgs(["r1cs", "info", artifactPaths.r1cs]));
  await runTrustedSetup();

  await writeJson(artifactPaths.buildStatus, {
    circuit: "circuits/claim/claim.circom",
    proofSystem: "Groth16",
    status: "compiled",
    trustedSetup: "deterministic_development_only",
    warning:
      "Development trusted setup is reproducible for demos and tests only; production needs a real ceremony.",
    artifacts: [
      "claim.r1cs",
      "claim.sym",
      "claim_js/claim.wasm",
      "claim_js/generate_witness.js",
      "pot12_final.ptau",
      "claim_final.zkey",
      "verification_key.json"
    ]
  });

  console.log("ZK build completed with real Circom compilation and Groth16 setup.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
