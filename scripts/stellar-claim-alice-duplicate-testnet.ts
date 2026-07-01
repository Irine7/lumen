import {
  aliceDuplicateClaimPath,
  aliceProofHex,
  alicePublicInputsArgPath,
  alicePublicInputs,
  claimPublicInputsFromNamedInputs,
  invokeContract,
  outputContainsContractError,
  readDeployment,
  requireCleanSourceAccount,
  run,
  writeJson
} from "./stellar-testnet-common";

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const deployment = await readDeployment();

  run("pnpm", ["zk:prove:demo"]);
  const publicInputs = await alicePublicInputs();
  const contractPublicInputs = claimPublicInputsFromNamedInputs(publicInputs);
  await writeJson(alicePublicInputsArgPath, contractPublicInputs);
  const proof = await aliceProofHex();

  const claim = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "claim",
    fnArgs: ["--public_inputs-file-path", alicePublicInputsArgPath, "--proof", proof],
    allowFailure: true
  });

  if (claim.status === 0) {
    throw new Error("Alice duplicate claim unexpectedly succeeded");
  }

  if (!outputContainsContractError(claim, 10)) {
    throw new Error("Alice duplicate claim failed, but not with DuplicateNullifier (#10)");
  }

  await writeJson(aliceDuplicateClaimPath, {
    network: "testnet",
    status: "duplicate_rejected",
    campaignContractId: deployment.campaignContractId,
    verifierContractId: deployment.verifierContractId,
    nullifierHash: publicInputs.nullifierHash,
    rejectedAt: new Date().toISOString(),
    expectedContractError: "DuplicateNullifier #10",
    localCryptographicProofVerification: "real",
    onChainCryptographicProofVerification: "real",
    notes:
      "Second submission used Alice's same public nullifier and Groth16 proof. The deployed campaign rejected it as a duplicate."
  });
  console.log("[ok] Alice duplicate claim rejected on testnet");
  console.log(`[ok] wrote ${aliceDuplicateClaimPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
