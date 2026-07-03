import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEMO_PAYOUT_ADDRESS, testnetDemoRecipients } from "@lumen-aid/shared";
import { derivePayoutAccountHash } from "@lumen-aid/stellar";
import {
  artifactPaths,
  assertBuildArtifactsPresent,
  assertCircuitInputs,
  createDemoCircuitCase,
  nodeArgs,
  publicSignalsFromInputs,
  readJson as readZkJson,
  runCommand,
  snarkjsArgs,
  writeJson as writeZkJson
} from "../circuits/claim/scripts/zk";
import {
  activeTestnetPath,
  claimPublicInputsFromNamedInputs,
  invokeContract,
  outputContainsContractError,
  readJson,
  requireCleanSourceAccount,
  strip0x,
  type ActiveTestnetDeployment
} from "./stellar-testnet-common";

type ProofJson = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
};

type ContractStats = {
  total_claimed: string;
  claim_count: number;
  remaining_budget: string;
  duplicate_claims_blocked: number;
  invalid_claims_blocked: number;
};

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

function fieldToHex(value: string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

async function proofHex(path: string): Promise<string> {
  const proof = await readZkJson<ProofJson>(path);
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

function campaignOverride(active: ActiveTestnetDeployment) {
  const asset = active.assetContractId ?? active.mockTokenContractId ?? active.asset;
  return {
    campaignId: active.campaignId,
    eligibilityRoot: active.eligibilityRoot,
    complianceRoot: active.complianceRoot,
    policyHash: active.policyHash,
    operator: active.operator,
    asset,
    verifier: active.verifierContractId,
    budget: Number(active.budget),
    perRecipientCap: Number(active.perRecipientCap),
    startLedger: active.startLedger,
    endLedger: active.endLedger,
    isActive: true
  };
}

function activePayoutAddress(active: ActiveTestnetDeployment, recipientId: string): string {
  return (
    active.recipients.find((item) => item.id === recipientId)?.payoutAddress ??
    DEMO_PAYOUT_ADDRESS
  );
}

async function generateProof(args: {
  active: ActiveTestnetDeployment;
  recipientId: "charlie";
  payoutAddress: string;
  tempDir: string;
}) {
  const demoCase = createDemoCircuitCase({
    recipientId: args.recipientId,
    recipients: testnetDemoRecipients,
    campaignOverride: campaignOverride(args.active),
    payoutAccountHash: derivePayoutAccountHash(args.payoutAddress)
  });
  assertCircuitInputs(demoCase);

  const inputPath = join(args.tempDir, `${args.recipientId}-input.json`);
  const namedPublicPath = join(args.tempDir, `${args.recipientId}-public-inputs.json`);
  const witnessPath = join(args.tempDir, `${args.recipientId}-witness.wtns`);
  const proofPath = join(args.tempDir, `${args.recipientId}-proof.json`);
  const publicPath = join(args.tempDir, `${args.recipientId}-public.json`);

  await writeZkJson(inputPath, demoCase.circuitInputs);
  await writeZkJson(namedPublicPath, demoCase.publicInputs);
  runCommand(nodeArgs([artifactPaths.witnessGenerator, artifactPaths.wasm, inputPath, witnessPath]));
  runCommand(
    await snarkjsArgs([
      "groth16",
      "prove",
      artifactPaths.zkeyFinal,
      witnessPath,
      proofPath,
      publicPath
    ])
  );
  const verify = runCommand(
    await snarkjsArgs([
      "groth16",
      "verify",
      artifactPaths.verificationKey,
      publicPath,
      proofPath
    ]),
    { allowFailure: true }
  );
  if (verify.status !== 0) {
    throw new Error("Charlie local snarkjs verification failed");
  }

  const publicSignals = await readZkJson<string[]>(publicPath);
  const expected = publicSignalsFromInputs(demoCase.publicInputs);
  if (JSON.stringify(publicSignals) !== JSON.stringify(expected)) {
    throw new Error("Charlie public signals do not match expected public input order");
  }

  return {
    demoCase,
    proof: await proofHex(proofPath)
  };
}

async function writePublicInputsArg(path: string, publicInputs: Parameters<typeof claimPublicInputsFromNamedInputs>[0]) {
  await writeFile(`${path}`, `${JSON.stringify(claimPublicInputsFromNamedInputs(publicInputs), null, 2)}\n`, "utf8");
}

function readStats(active: ActiveTestnetDeployment, sourceAccount: string): ContractStats {
  const result = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_stats",
    send: "no",
    suppressOutput: true
  });
  return parseJson<ContractStats>(result.stdout, "get_stats");
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
  if (active.network !== "testnet") {
    throw new Error("Active campaign is not testnet");
  }
  ok("Active campaign loaded");

  if (active.verifierInfo.mode !== "real_groth16") {
    throw new Error(`Expected real_groth16 verifier, found ${active.verifierInfo.mode}`);
  }
  ok("Verifier info: real_groth16");

  assertBuildArtifactsPresent();
  const tempDir = await mkdtemp(join(tmpdir(), "lumen-smoke-testnet-"));

  try {
    const { demoCase: charlie, proof } = await generateProof({
      active,
      recipientId: "charlie",
      payoutAddress: activePayoutAddress(active, "charlie"),
      tempDir
    });
    ok("Charlie proof generated");
    ok("Charlie local verification passed");

    const charliePublicInputsPath = join(tempDir, "charlie-public-inputs.arg.json");
    await writePublicInputsArg(charliePublicInputsPath, charlie.publicInputs);

    const verifierCheck = invokeContract({
      contractId: active.verifierContractId,
      sourceAccount,
      fn: "verify_claim",
      fnArgs: ["--public_inputs-file-path", charliePublicInputsPath, "--proof", proof],
      send: "no",
      suppressOutput: true
    });
    if (!/\btrue\b/.test(verifierCheck.stdout)) {
      throw new Error("Verifier simulation did not accept Charlie proof");
    }

    const claim = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        charliePublicInputsPath,
        "--proof",
        proof,
        "--payout_recipient",
        activePayoutAddress(active, "charlie")
      ]
    });
    if (claim.status !== 0) {
      throw new Error("Charlie claim failed on testnet");
    }
    ok("Charlie claim accepted on testnet");

    const duplicate = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        charliePublicInputsPath,
        "--proof",
        proof,
        "--payout_recipient",
        activePayoutAddress(active, "charlie")
      ],
      allowFailure: true
    });
    if (duplicate.status === 0 || !outputContainsContractError(duplicate, 10)) {
      throw new Error("Charlie duplicate was not rejected with DuplicateNullifier");
    }
    ok("Charlie duplicate rejected on testnet");

    const mallory = createDemoCircuitCase({
      recipientId: "mallory",
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(active),
      payoutAccountHash: derivePayoutAccountHash(activePayoutAddress(active, "mallory"))
    });
    if (mallory.circuitInputs) {
      throw new Error("Mallory unexpectedly produced private circuit inputs");
    }
    ok("Mallory rejected locally");

    const eve = createDemoCircuitCase({
      recipientId: "eve",
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(active),
      payoutAccountHash: derivePayoutAccountHash(activePayoutAddress(active, "eve"))
    });
    if (eve.circuitInputs) {
      throw new Error("Eve unexpectedly produced private circuit inputs without compliance clearance");
    }
    ok("Non-compliant Eve rejected locally");

    const malformed = invokeContract({
      contractId: active.verifierContractId,
      sourceAccount,
      fn: "verify_claim",
      fnArgs: ["--public_inputs-file-path", charliePublicInputsPath, "--proof", "00"],
      send: "no",
      suppressOutput: true
    });
    if (!/\bfalse\b/.test(malformed.stdout)) {
      throw new Error("Malformed proof was not rejected by verifier simulation");
    }
    ok("Malformed proof rejected by verifier simulation");

    const wrongRootPath = join(tempDir, "wrong-root-public-inputs.arg.json");
    await writePublicInputsArg(wrongRootPath, {
      ...charlie.publicInputs,
      eligibilityRoot: "0x0000000000000000000000000000000000000000000000000000000000000001"
    });
    const wrongRoot = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        wrongRootPath,
        "--proof",
        proof,
        "--payout_recipient",
        activePayoutAddress(active, "charlie")
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (wrongRoot.status === 0 || !outputContainsContractError(wrongRoot, 5)) {
      throw new Error("Wrong root was not rejected");
    }
    ok("Wrong root rejected");

    const wrongComplianceRootPath = join(tempDir, "wrong-compliance-root-public-inputs.arg.json");
    await writePublicInputsArg(wrongComplianceRootPath, {
      ...charlie.publicInputs,
      complianceRoot: "0x0000000000000000000000000000000000000000000000000000000000000003"
    });
    const wrongComplianceRoot = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        wrongComplianceRootPath,
        "--proof",
        proof,
        "--payout_recipient",
        activePayoutAddress(active, "charlie")
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (
      wrongComplianceRoot.status === 0 ||
      !outputContainsContractError(wrongComplianceRoot, 16)
    ) {
      throw new Error("Wrong compliance root was not rejected");
    }
    ok("Wrong compliance root rejected");

    const wrongPolicyPath = join(tempDir, "wrong-policy-public-inputs.arg.json");
    await writePublicInputsArg(wrongPolicyPath, {
      ...charlie.publicInputs,
      policyHash: "0x0000000000000000000000000000000000000000000000000000000000000002"
    });
    const wrongPolicy = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        wrongPolicyPath,
        "--proof",
        proof,
        "--payout_recipient",
        activePayoutAddress(active, "charlie")
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (wrongPolicy.status === 0 || !outputContainsContractError(wrongPolicy, 6)) {
      throw new Error("Wrong policy was not rejected");
    }
    ok("Wrong policy rejected");

    const overCap = createDemoCircuitCase({
      recipientId: "charlie",
      recipients: testnetDemoRecipients,
      amount: Number(active.perRecipientCap) + 1,
      campaignOverride: campaignOverride(active),
      payoutAccountHash: derivePayoutAccountHash(activePayoutAddress(active, "charlie"))
    });
    assertCircuitInputs(overCap);
    const overCapInputPath = join(tempDir, "over-cap-input.json");
    const overCapWitnessPath = join(tempDir, "over-cap-witness.wtns");
    await writeZkJson(overCapInputPath, overCap.circuitInputs);
    const overCapWitness = runCommand(
      nodeArgs([artifactPaths.witnessGenerator, artifactPaths.wasm, overCapInputPath, overCapWitnessPath]),
      { allowFailure: true, suppressOutput: true }
    );
    if (overCapWitness.status === 0) {
      throw new Error("Over-cap witness unexpectedly generated");
    }
    ok("Over-cap rejected");

    const finalStats = readStats(active, sourceAccount);
    if (
      finalStats.total_claimed !== String(charlie.publicInputs.amount) ||
      finalStats.claim_count !== 1 ||
      finalStats.remaining_budget !== String(Number(active.budget) - charlie.publicInputs.amount)
    ) {
      throw new Error(
        `Unexpected final stats: ${JSON.stringify(finalStats)}`
      );
    }
    ok("Final stats correct");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
