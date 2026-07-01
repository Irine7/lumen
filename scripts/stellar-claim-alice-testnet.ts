import {
  aliceClaimPath,
  aliceProofHex,
  alicePublicInputsArgPath,
  alicePublicInputs,
  campaignStatePath,
  claimPublicInputsFromNamedInputs,
  invokeContract,
  outputContainsContractError,
  readDeployment,
  readJson,
  requireCleanSourceAccount,
  run,
  writeJson,
  type TestnetCampaignState
} from "./stellar-testnet-common";
import { existsSync } from "node:fs";

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const deployment = await readDeployment();
  await readJson<TestnetCampaignState>(campaignStatePath);

  run("pnpm", ["zk:prove:demo"]);
  run("pnpm", ["zk:verify:local"]);

  const publicInputs = await alicePublicInputs();
  const contractPublicInputs = claimPublicInputsFromNamedInputs(publicInputs);
  await writeJson(alicePublicInputsArgPath, contractPublicInputs);
  const proof = await aliceProofHex();

  const verifierCheck = invokeContract({
    contractId: deployment.verifierContractId,
    sourceAccount,
    fn: "verify_claim",
    fnArgs: ["--public_inputs-file-path", alicePublicInputsArgPath, "--proof", proof],
    send: "no",
    suppressOutput: true
  });
  if (!/\btrue\b/.test(verifierCheck.stdout)) {
    throw new Error("On-chain verifier simulation did not accept Alice proof");
  }
  console.log("[ok] On-chain verifier simulation accepted Alice Groth16 proof");

  const duplicateProbe = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "is_nullifier_used",
    fnArgs: ["--nullifier_hash", contractPublicInputs.nullifier_hash],
    send: "no",
    suppressOutput: true
  });
  if (/\btrue\b/.test(duplicateProbe.stdout)) {
    if (existsSync(aliceClaimPath)) {
      const previous = await readJson<{ status?: string; nullifierHash?: string }>(aliceClaimPath);
      if (previous.status === "accepted" && previous.nullifierHash === publicInputs.nullifierHash) {
        console.log("[ok] Alice first claim already accepted on testnet");
        console.log(`[ok] existing evidence: ${aliceClaimPath}`);
        return;
      }
    }
    throw new Error("Alice nullifier is already used on testnet, but no matching local acceptance record was found.");
  }

  const claim = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "claim",
    fnArgs: ["--public_inputs-file-path", alicePublicInputsArgPath, "--proof", proof]
  });
  if (claim.status !== 0) {
    if (outputContainsContractError(claim, 10)) {
      throw new Error("Alice claim was rejected as duplicate; first-claim smoke test requires an unused nullifier.");
    }
    throw new Error("Alice claim failed on testnet");
  }

  await writeJson(aliceClaimPath, {
    network: "testnet",
    status: "accepted",
    campaignContractId: deployment.campaignContractId,
    verifierContractId: deployment.verifierContractId,
    nullifierHash: publicInputs.nullifierHash,
    amount: publicInputs.amount,
    claimedAt: new Date().toISOString(),
    localCryptographicProofVerification: "real",
    onChainCryptographicProofVerification: "real",
    notes:
      "Alice proof was generated locally with snarkjs, verified locally, accepted by the deployed testnet verifier in simulation, and submitted to the campaign contract."
  });
  console.log("[ok] Alice first claim accepted on testnet");
  console.log(`[ok] wrote ${aliceClaimPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
