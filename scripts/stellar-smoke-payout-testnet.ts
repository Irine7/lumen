import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testnetDemoRecipients, type DemoRecipient } from "@lumen-aid/shared";
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

function parseInteger(stdout: string, label: string): string {
  const match = stdout.match(/-?\d+/);
  if (!match) {
    throw new Error(`Could not parse integer from ${label}`);
  }
  return match[0];
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

function assetContractId(active: ActiveTestnetDeployment): string {
  const id = active.assetContractId ?? active.mockTokenContractId;
  if (!id) {
    throw new Error("Active payout campaign is missing assetContractId");
  }
  return id;
}

function campaignOverride(active: ActiveTestnetDeployment) {
  return {
    campaignId: active.campaignId,
    eligibilityRoot: active.eligibilityRoot,
    complianceRoot: active.complianceRoot,
    policyHash: active.policyHash,
    operator: active.operator,
    asset: assetContractId(active),
    verifier: active.verifierContractId,
    budget: Number(active.budget),
    perRecipientCap: Number(active.perRecipientCap),
    startLedger: active.startLedger,
    endLedger: active.endLedger,
    isActive: true
  };
}

function activePayoutAddress(active: ActiveTestnetDeployment, recipientId: string): string {
  const recipient = active.recipients.find((item) => item.id === recipientId);
  if (!recipient?.payoutAddress) {
    throw new Error(`Active deployment is missing payout address for ${recipientId}`);
  }
  return recipient.payoutAddress;
}

function isNullifierUsed(args: {
  active: ActiveTestnetDeployment;
  sourceAccount: string;
  nullifierHash: string;
}): boolean {
  const result = invokeContract({
    contractId: args.active.campaignContractId,
    sourceAccount: args.sourceAccount,
    fn: "is_nullifier_used",
    fnArgs: ["--nullifier_hash", strip0x(args.nullifierHash)],
    send: "no",
    suppressOutput: true
  });
  return /\btrue\b/.test(result.stdout);
}

function selectCompliantRecipient(args: {
  active: ActiveTestnetDeployment;
  sourceAccount: string;
  amount: number;
}): { recipientId: DemoRecipient["id"]; payoutAddress: string; displayName: string } {
  const preferred: DemoRecipient["id"][] = ["charlie", "alice", "bob", "dora"];

  for (const recipientId of preferred) {
    const recipient = args.active.recipients.find((item) => item.id === recipientId);
    if (!recipient?.eligible || !recipient.compliant || !recipient.payoutAddress) {
      continue;
    }

    const demoCase = createDemoCircuitCase({
      recipientId,
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(args.active),
      amount: args.amount,
      payoutAccountHash: derivePayoutAccountHash(recipient.payoutAddress)
    });
    assertCircuitInputs(demoCase);

    if (
      !isNullifierUsed({
        active: args.active,
        sourceAccount: args.sourceAccount,
        nullifierHash: demoCase.publicInputs.nullifierHash
      })
    ) {
      return {
        recipientId,
        payoutAddress: recipient.payoutAddress,
        displayName: recipient.displayName
      };
    }
  }

  throw new Error("No unclaimed compliant recipient remains for live payout smoke.");
}

async function generateProof(args: {
  active: ActiveTestnetDeployment;
  recipientId: DemoRecipient["id"];
  payoutAddress: string;
  amount: number;
  tempDir: string;
}) {
  const payoutAccountHash = derivePayoutAccountHash(args.payoutAddress);
  const demoCase = createDemoCircuitCase({
    recipientId: args.recipientId,
    recipients: testnetDemoRecipients,
    campaignOverride: campaignOverride(args.active),
    amount: args.amount,
    payoutAccountHash
  });
  assertCircuitInputs(demoCase);

  const inputPath = join(args.tempDir, `${args.recipientId}-input.json`);
  const witnessPath = join(args.tempDir, `${args.recipientId}-witness.wtns`);
  const proofPath = join(args.tempDir, `${args.recipientId}-proof.json`);
  const publicPath = join(args.tempDir, `${args.recipientId}-public.json`);

  await writeZkJson(inputPath, demoCase.circuitInputs);
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
    throw new Error(`${demoCase.recipient.displayName} local snarkjs verification failed`);
  }

  const publicSignals = await readZkJson<string[]>(publicPath);
  const expected = publicSignalsFromInputs(demoCase.publicInputs);
  if (JSON.stringify(publicSignals) !== JSON.stringify(expected)) {
    throw new Error(`${demoCase.recipient.displayName} public signals do not match expected public input order`);
  }

  return {
    demoCase,
    proof: await proofHex(proofPath)
  };
}

async function writePublicInputsArg(
  path: string,
  publicInputs: Parameters<typeof claimPublicInputsFromNamedInputs>[0]
): Promise<void> {
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

function readEscrow(active: ActiveTestnetDeployment, sourceAccount: string): bigint {
  const result = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_escrow_balance",
    send: "no",
    suppressOutput: true
  });
  return BigInt(parseInteger(result.stdout, "get_escrow_balance"));
}

function tokenBalance(args: {
  active: ActiveTestnetDeployment;
  sourceAccount: string;
  id: string;
}): bigint {
  const result = invokeContract({
    contractId: assetContractId(args.active),
    sourceAccount: args.sourceAccount,
    fn: "balance",
    fnArgs: ["--id", args.id],
    send: "no",
    suppressOutput: true
  });
  return BigInt(parseInteger(result.stdout, "token balance"));
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
  if (active.network !== "testnet") {
    throw new Error("Active campaign is not testnet");
  }
  if (active.assetMode === "aidusd_sac" && active.assetCode === "AIDUSD") {
    ok("AIDUSD asset ready");
  }
  ok("Fresh compliance campaign loaded");

  if (active.verifierInfo.mode !== "real_groth16") {
    throw new Error(`Expected real_groth16 verifier, found ${active.verifierInfo.mode}`);
  }
  ok("Verifier mode: real_groth16");

  if (!active.complianceRoot) {
    throw new Error("Active campaign is missing complianceRoot");
  }
  ok("Compliance root present");

  if (!active.assetContractId) {
    throw new Error("Active campaign is not using the real payout assetContractId path");
  }
  ok("Asset contract ready");

  assertBuildArtifactsPresent();
  const initialStats = readStats(active, sourceAccount);
  const initialEscrow = readEscrow(active, sourceAccount);
  if (initialEscrow <= 0n) {
    throw new Error(`Escrow is not funded: ${initialEscrow}`);
  }
  ok(`Escrow funded: ${initialEscrow}`);

  const tempDir = await mkdtemp(join(tmpdir(), "lumen-smoke-payout-testnet-"));

  try {
    const amount = Number(active.perRecipientCap);
    const selected = selectCompliantRecipient({ active, sourceAccount, amount });
    const payoutAddress = selected.payoutAddress;
    const swappedAddress = activePayoutAddress(
      active,
      selected.recipientId === "dora" ? "alice" : "dora"
    );
    const { demoCase: selectedCase, proof } = await generateProof({
      active,
      recipientId: selected.recipientId,
      payoutAddress,
      amount,
      tempDir
    });
    ok(`${selected.displayName} proof generated`);
    ok(`${selected.displayName} proof bound to payout address`);
    ok(`${selected.displayName} local verification passed`);

    const selectedPublicInputsPath = join(tempDir, `${selected.recipientId}-public-inputs.arg.json`);
    await writePublicInputsArg(selectedPublicInputsPath, selectedCase.publicInputs);

    const verifierCheck = invokeContract({
      contractId: active.verifierContractId,
      sourceAccount,
      fn: "verify_claim",
      fnArgs: ["--public_inputs-file-path", selectedPublicInputsPath, "--proof", proof],
      send: "no",
      suppressOutput: true
    });
    if (!/\btrue\b/.test(verifierCheck.stdout)) {
      throw new Error(`Verifier simulation did not accept ${selected.displayName} proof`);
    }

    const malformedProof = `${proof.slice(0, -2)}${proof.endsWith("00") ? "01" : "00"}`;
    const malformed = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        selectedPublicInputsPath,
        "--proof",
        malformedProof,
        "--payout_recipient",
        payoutAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (malformed.status === 0 || !outputContainsContractError(malformed, 11)) {
      throw new Error("Malformed proof was not rejected with InvalidProof");
    }
    ok("Malformed proof rejected");

    const recipientBefore = tokenBalance({ active, sourceAccount, id: payoutAddress });
    const escrowBefore = readEscrow(active, sourceAccount);
    const claim = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        selectedPublicInputsPath,
        "--proof",
        proof,
        "--payout_recipient",
        payoutAddress
      ]
    });
    if (claim.status !== 0) {
      throw new Error(`${selected.displayName} payout claim failed on testnet`);
    }
    ok(`${selected.displayName} AIDUSD payout accepted on testnet`);

    const recipientAfter = tokenBalance({ active, sourceAccount, id: payoutAddress });
    const escrowAfter = readEscrow(active, sourceAccount);
    const recipientDelta = recipientAfter - recipientBefore;
    const escrowDelta = escrowBefore - escrowAfter;
    if (recipientDelta !== BigInt(amount)) {
      throw new Error(`Recipient balance delta mismatch: expected ${amount}, got ${recipientDelta}`);
    }
    if (escrowDelta !== BigInt(amount)) {
      throw new Error(`Escrow balance delta mismatch: expected ${amount}, got ${escrowDelta}`);
    }
    ok(`Recipient balance increased by ${amount}`);
    ok(`Escrow balance decreased by ${amount}`);

    const duplicateRecipientBefore = tokenBalance({ active, sourceAccount, id: payoutAddress });
    const duplicateEscrowBefore = readEscrow(active, sourceAccount);
    const duplicate = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        selectedPublicInputsPath,
        "--proof",
        proof,
        "--payout_recipient",
        payoutAddress
      ],
      allowFailure: true,
      suppressOutput: true
    });
    if (duplicate.status === 0 || !outputContainsContractError(duplicate, 10)) {
      throw new Error(`${selected.displayName} duplicate was not rejected with DuplicateNullifier`);
    }
    if (
      tokenBalance({ active, sourceAccount, id: payoutAddress }) !== duplicateRecipientBefore ||
      readEscrow(active, sourceAccount) !== duplicateEscrowBefore
    ) {
      throw new Error("Duplicate changed recipient or escrow balance");
    }
    ok("Duplicate rejected with no transfer");

    const swappedBefore = tokenBalance({ active, sourceAccount, id: swappedAddress });
    const swapped = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        selectedPublicInputsPath,
        "--proof",
        proof,
        "--payout_recipient",
        swappedAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (swapped.status === 0 || !outputContainsContractError(swapped, 13)) {
      throw new Error("Swapped payout recipient was not rejected with WrongPayoutRecipient");
    }
    if (tokenBalance({ active, sourceAccount, id: swappedAddress }) !== swappedBefore) {
      throw new Error("Swapped recipient balance changed");
    }
    ok("Swapped recipient rejected");

    const tamperedHashPath = join(tempDir, "tampered-payout-hash.arg.json");
    await writePublicInputsArg(tamperedHashPath, {
      ...selectedCase.publicInputs,
      payoutAccountHash:
        selectedCase.publicInputs.payoutAccountHash ===
        "0x0000000000000000000000000000000000000000000000000000000000000001"
          ? "0x0000000000000000000000000000000000000000000000000000000000000002"
          : "0x0000000000000000000000000000000000000000000000000000000000000001"
    });
    const tampered = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        tamperedHashPath,
        "--proof",
        proof,
        "--payout_recipient",
        payoutAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (tampered.status === 0 || !outputContainsContractError(tampered, 13)) {
      throw new Error("Tampered payout hash was not rejected with WrongPayoutRecipient");
    }
    ok("Tampered payout hash rejected");

    const wrongEligibilityRootPath = join(tempDir, "wrong-eligibility-root-public-inputs.arg.json");
    await writePublicInputsArg(wrongEligibilityRootPath, {
      ...selectedCase.publicInputs,
      eligibilityRoot: "0x0000000000000000000000000000000000000000000000000000000000000002"
    });
    const wrongEligibilityRoot = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "claim",
      fnArgs: [
        "--public_inputs-file-path",
        wrongEligibilityRootPath,
        "--proof",
        proof,
        "--payout_recipient",
        payoutAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (
      wrongEligibilityRoot.status === 0 ||
      !outputContainsContractError(wrongEligibilityRoot, 5)
    ) {
      throw new Error("Wrong eligibility root was not rejected with WrongEligibilityRoot");
    }
    ok("Wrong eligibility root rejected");

    const wrongComplianceRootPath = join(tempDir, "wrong-compliance-root-public-inputs.arg.json");
    await writePublicInputsArg(wrongComplianceRootPath, {
      ...selectedCase.publicInputs,
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
        payoutAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (
      wrongComplianceRoot.status === 0 ||
      !outputContainsContractError(wrongComplianceRoot, 16)
    ) {
      throw new Error("Wrong compliance root was not rejected with WrongComplianceRoot");
    }
    ok("Wrong compliance root rejected");

    const wrongPolicyPath = join(tempDir, "wrong-policy-public-inputs.arg.json");
    await writePublicInputsArg(wrongPolicyPath, {
      ...selectedCase.publicInputs,
      policyHash: "0x0000000000000000000000000000000000000000000000000000000000000004"
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
        payoutAddress
      ],
      allowFailure: true,
      send: "no",
      suppressOutput: true
    });
    if (wrongPolicy.status === 0 || !outputContainsContractError(wrongPolicy, 6)) {
      throw new Error("Wrong policy was not rejected with WrongPolicyHash");
    }
    ok("Wrong policy rejected");

    const mallory = createDemoCircuitCase({
      recipientId: "mallory",
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(active),
      amount,
      payoutAccountHash: derivePayoutAccountHash(activePayoutAddress(active, "mallory"))
    });
    if (mallory.circuitInputs) {
      throw new Error("Mallory unexpectedly produced private circuit inputs");
    }
    ok("Mallory rejected");

    const eve = createDemoCircuitCase({
      recipientId: "eve",
      recipients: testnetDemoRecipients,
      campaignOverride: campaignOverride(active),
      amount,
      payoutAccountHash: derivePayoutAccountHash(activePayoutAddress(active, "eve"))
    });
    if (eve.circuitInputs) {
      throw new Error("Eve unexpectedly produced private circuit inputs without compliance clearance");
    }
    ok("Non-compliant Eve rejected");

    const overCap = createDemoCircuitCase({
      recipientId: selected.recipientId,
      recipients: testnetDemoRecipients,
      amount: Number(active.perRecipientCap) + 1,
      campaignOverride: campaignOverride(active),
      payoutAccountHash: derivePayoutAccountHash(payoutAddress)
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
    const finalEscrow = readEscrow(active, sourceAccount);
    const finalRecipient = tokenBalance({ active, sourceAccount, id: payoutAddress });
    const expectedTotalClaimed = BigInt(initialStats.total_claimed) + BigInt(amount);
    const expectedRemainingBudget = BigInt(initialStats.remaining_budget) - BigInt(amount);
    if (
      BigInt(finalStats.total_claimed) !== expectedTotalClaimed ||
      finalStats.claim_count !== initialStats.claim_count + 1 ||
      BigInt(finalStats.remaining_budget) !== expectedRemainingBudget ||
      finalEscrow !== escrowAfter ||
      finalRecipient !== recipientAfter
    ) {
      throw new Error(
        `Unexpected final stats/balances: ${JSON.stringify({
          initialStats,
          finalStats,
          finalEscrow: finalEscrow.toString(),
          finalRecipient: finalRecipient.toString()
        })}`
      );
    }
    ok("Final balances correct");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
