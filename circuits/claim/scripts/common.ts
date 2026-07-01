import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CampaignConfig,
  ClaimPrivateInputs,
  ClaimPublicInputs,
  Hex32
} from "@lumen-aid/shared";
import { demoRecipients } from "@lumen-aid/shared";
import {
  buildDemoEligibilityTree,
  createDemoCampaignConfig,
  deriveNullifier,
  getMerkleProofForRecipient,
  toFieldString
} from "@lumen-aid/merkle";
import {
  formatPublicInputsForSoroban,
  generateClaimProof,
  verifyClaimProofLocally
} from "@lumen-aid/prover";

const here = dirname(fileURLToPath(import.meta.url));
export const claimDir = join(here, "..");
export const buildDir = join(claimDir, "build");

export async function ensureBuildDir(): Promise<void> {
  await mkdir(buildDir, { recursive: true });
}

export async function createAliceDemoProof() {
  const proofPath = await createProofPathDemo();

  return {
    tree: proofPath.tree,
    campaign: proofPath.campaign,
    recipient: proofPath.alice.recipient,
    result: proofPath.alice.result,
    sorobanPublicInputs: proofPath.alice.sorobanPublicInputs
  };
}

export async function createProofPathDemo() {
  const tree = buildDemoEligibilityTree();
  const campaign = createDemoCampaignConfig(tree);
  const alice = demoRecipients.find((recipient) => recipient.id === "alice");
  const mallory = demoRecipients.find((recipient) => recipient.id === "mallory");

  if (!alice) {
    throw new Error("Alice fixture is missing");
  }

  if (!mallory) {
    throw new Error("Mallory fixture is missing");
  }

  const aliceResult = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: alice,
    amount: alice.defaultClaimAmount
  });
  const aliceVerification = await verifyClaimProofLocally(
    aliceResult.proof,
    aliceResult.publicInputs
  );

  const aliceRepeatResult = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: alice,
    amount: alice.defaultClaimAmount
  });

  const differentCampaignId =
    "0x00000000000000000000000000000000000000000000000000000000000000a7" as Hex32;
  const differentCampaign: CampaignConfig = {
    ...campaign,
    campaignId: differentCampaignId
  };
  const aliceDifferentCampaignResult = await generateClaimProof({
    mode: "dev_verifier",
    campaign: differentCampaign,
    tree,
    recipient: alice,
    amount: alice.defaultClaimAmount
  });

  const aliceMerkleProof = getMerkleProofForRecipient(tree, alice);

  if (!aliceMerkleProof) {
    throw new Error("Alice Merkle proof is missing");
  }

  const malloryResult = await generateClaimProof({
    mode: "dev_verifier",
    campaign,
    tree,
    recipient: mallory,
    amount: mallory.defaultClaimAmount,
    proofOverride: {
      merkleProof: aliceMerkleProof
    }
  });
  const malloryVerification = await verifyClaimProofLocally(
    malloryResult.proof,
    malloryResult.publicInputs
  );

  const aliceNullifierFromSecret = deriveNullifier(
    alice.recipientSecret,
    campaign.campaignId
  );

  const nullifierChecks = {
    derivedFromRecipientSecretAndCampaignId: aliceNullifierFromSecret,
    alicePublicInputNullifier: aliceResult.publicInputs.nullifierHash,
    aliceRepeatSameCampaignNullifier: aliceRepeatResult.publicInputs.nullifierHash,
    aliceDifferentCampaignId: differentCampaignId,
    aliceDifferentCampaignNullifier:
      aliceDifferentCampaignResult.publicInputs.nullifierHash,
    sameCampaignReusesNullifier:
      aliceResult.publicInputs.nullifierHash.toLowerCase() ===
        aliceRepeatResult.publicInputs.nullifierHash.toLowerCase() &&
      aliceNullifierFromSecret.toLowerCase() ===
        aliceResult.publicInputs.nullifierHash.toLowerCase(),
    differentCampaignChangesNullifier:
      aliceResult.publicInputs.nullifierHash.toLowerCase() !==
      aliceDifferentCampaignResult.publicInputs.nullifierHash.toLowerCase()
  };

  const summary = {
    mode: aliceResult.mode,
    campaignId: campaign.campaignId,
    eligibilityRoot: campaign.eligibilityRoot,
    policyHash: campaign.policyHash,
    eligibleDemoRecipients: tree.eligibleRecipients.map((recipient) => recipient.id),
    alice: {
      amount: alice.defaultClaimAmount,
      proofGenerated: aliceResult.ok,
      localVerification: aliceVerification,
      nullifierHash: aliceResult.publicInputs.nullifierHash,
      publicInputsHash: aliceResult.proof.publicInputsHash
    },
    mallory: {
      amount: mallory.defaultClaimAmount,
      proofGenerated: malloryResult.ok,
      localVerification: malloryVerification,
      errors: malloryResult.errors,
      attemptedNullifierHash: malloryResult.publicInputs.nullifierHash
    },
    nullifiers: nullifierChecks
  };

  const pass =
    aliceResult.ok &&
    aliceVerification &&
    !malloryResult.ok &&
    !malloryVerification &&
    nullifierChecks.sameCampaignReusesNullifier &&
    nullifierChecks.differentCampaignChangesNullifier;

  return {
    pass,
    tree,
    campaign,
    alice: {
      recipient: alice,
      result: aliceResult,
      repeatedResult: aliceRepeatResult,
      differentCampaignResult: aliceDifferentCampaignResult,
      sorobanPublicInputs: formatPublicInputsForSoroban(aliceResult.publicInputs),
      localVerification: aliceVerification
    },
    mallory: {
      recipient: mallory,
      result: malloryResult,
      sorobanPublicInputs: formatPublicInputsForSoroban(malloryResult.publicInputs),
      localVerification: malloryVerification
    },
    nullifierChecks,
    summary
  };
}

export async function writeProofPathArtifacts(
  proofPath: Awaited<ReturnType<typeof createProofPathDemo>>
): Promise<void> {
  await ensureBuildDir();
  await writeJson(join(buildDir, "eligibility-tree.json"), {
    root: proofPath.tree.root,
    leaves: proofPath.tree.leaves,
    layers: proofPath.tree.layers,
    eligibleRecipients: proofPath.tree.eligibleRecipients.map((recipient) => ({
      id: recipient.id,
      displayName: recipient.displayName
    }))
  });
  await writeJson(join(buildDir, "demo-campaign.json"), proofPath.campaign);
  await writeJson(join(buildDir, "alice-proof.json"), proofPath.alice.result.proof);
  await writeJson(join(buildDir, "alice-public-inputs.json"), proofPath.alice.result.publicInputs);
  await writeJson(
    join(buildDir, "alice-soroban-public-inputs.json"),
    proofPath.alice.sorobanPublicInputs
  );
  await writeJson(
    join(buildDir, "alice-private-inputs.debug.json"),
    proofPath.alice.result.privateInputs
  );
  await writeJson(
    join(buildDir, "alice-circom-input.json"),
    formatCircuitInputs(
      requirePrivateInputs(proofPath.alice.result.privateInputs, "Alice"),
      proofPath.alice.result.publicInputs
    )
  );
  await writeJson(join(buildDir, "mallory-invalid-attempt.json"), {
    ok: proofPath.mallory.result.ok,
    localVerification: proofPath.mallory.localVerification,
    errors: proofPath.mallory.result.errors,
    proof: proofPath.mallory.result.proof,
    publicInputs: proofPath.mallory.result.publicInputs,
    sorobanPublicInputs: proofPath.mallory.sorobanPublicInputs
  });
  await writeJson(
    join(buildDir, "mallory-private-inputs.invalid.debug.json"),
    proofPath.mallory.result.privateInputs
  );
  await writeJson(
    join(buildDir, "mallory-circom-input.invalid.json"),
    formatCircuitInputs(
      requirePrivateInputs(proofPath.mallory.result.privateInputs, "Mallory"),
      proofPath.mallory.result.publicInputs
    )
  );
  await writeJson(join(buildDir, "nullifier-checks.json"), proofPath.nullifierChecks);
  await writeJson(join(buildDir, "proof-path-summary.json"), proofPath.summary);

  await writeJson(join(buildDir, "proof.json"), proofPath.alice.result.proof);
  await writeJson(join(buildDir, "public.json"), proofPath.alice.result.publicInputs);
  await writeJson(
    join(buildDir, "private-inputs.debug.json"),
    proofPath.alice.result.privateInputs
  );
  await writeJson(
    join(buildDir, "demo-input.json"),
    formatCircuitInputs(
      requirePrivateInputs(proofPath.alice.result.privateInputs, "Alice"),
      proofPath.alice.result.publicInputs
    )
  );
  await writeJson(
    join(buildDir, "soroban-public-inputs.json"),
    proofPath.alice.sorobanPublicInputs
  );
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function requirePrivateInputs(
  privateInputs: ClaimPrivateInputs | undefined,
  label: string
): ClaimPrivateInputs {
  if (!privateInputs) {
    throw new Error(`${label} private inputs are missing`);
  }

  return privateInputs;
}

function field(value: string | number): string {
  return toFieldString(value);
}

export function formatCircuitInputs(
  privateInputs: ClaimPrivateInputs,
  publicInputs: ClaimPublicInputs
) {
  return {
    recipient_secret: field(privateInputs.recipientSecret),
    identity_hash: field(privateInputs.identityHash),
    leaf_salt: field(privateInputs.leafSalt),
    eligibility_merkle_path: privateInputs.eligibilityMerklePath.map((item) =>
      field(item)
    ),
    eligibility_merkle_indices: privateInputs.eligibilityMerkleIndices,
    amount_salt: field(privateInputs.amountSalt),
    campaign_id: field(publicInputs.campaignId),
    eligibility_root: field(publicInputs.eligibilityRoot),
    policy_hash: field(publicInputs.policyHash),
    nullifier_hash: field(publicInputs.nullifierHash),
    amount: publicInputs.amount.toString(),
    max_amount: publicInputs.maxAmount.toString(),
    amount_commitment: field(publicInputs.amountCommitment),
    recipient_commitment: field(publicInputs.recipientCommitment)
  };
}
