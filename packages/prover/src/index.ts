import type {
  CampaignConfig,
  ClaimPrivateInputs,
  ClaimProofEnvelope,
  ClaimProofResult,
  ClaimPublicInputs,
  DemoRecipient,
  Hex32,
  MerkleProof
} from "@lumen-aid/shared";
import {
  createEligibilityLeaf,
  derivePublicInputs,
  getMerkleProofForRecipient,
  publicInputsHash,
  verifyMerkleProofLocally,
  type DemoEligibilityTree
} from "@lumen-aid/merkle";

export interface GenerateClaimProofInput {
  mode: "dev_verifier";
  campaign: CampaignConfig;
  tree: DemoEligibilityTree;
  recipient: DemoRecipient;
  amount: number;
  proofOverride?: {
    merkleProof?: MerkleProof;
  };
}

export interface SorobanClaimPublicInputTuple {
  campaign_id: Hex32;
  eligibility_root: Hex32;
  policy_hash: Hex32;
  nullifier_hash: Hex32;
  amount_commitment: Hex32;
  recipient_commitment: Hex32;
  amount: string;
  max_amount: string;
}

const DEV_PROOF_PREFIX = "lumen-dev-verifier-v1";

function createPrivateInputs(
  recipient: DemoRecipient,
  proof: MerkleProof
): ClaimPrivateInputs {
  return {
    recipientSecret: recipient.recipientSecret,
    identityHash: recipient.identityHash,
    leafSalt: recipient.leafSalt,
    eligibilityMerklePath: proof.path,
    eligibilityMerkleIndices: proof.indices,
    amountSalt: recipient.amountSalt,
    eligibilityReason: recipient.eligibilityReason
  };
}

function createProofEnvelope(
  publicInputs: ClaimPublicInputs,
  ok: boolean
): ClaimProofEnvelope {
  const hash = publicInputsHash(publicInputs);
  const proof = ok
    ? `${DEV_PROOF_PREFIX}:${hash}`
    : `${DEV_PROOF_PREFIX}:invalid:${hash}`;

  return {
    protocol: "lumen_claim",
    circuitVersion: "claim_v0",
    mode: "dev_verifier",
    devVerifierDigest: hash,
    proof,
    publicInputsHash: hash
  };
}

export function validateClaimWitness(input: {
  campaign: CampaignConfig;
  recipient: DemoRecipient;
  amount: number;
  merkleProof: MerkleProof | null;
}): string[] {
  const errors: string[] = [];

  if (!input.campaign.isActive) {
    errors.push("Campaign is not active");
  }

  if (input.amount > input.campaign.perRecipientCap) {
    errors.push("Claim amount exceeds per-recipient cap");
  }

  if (input.amount <= 0) {
    errors.push("Claim amount must be positive");
  }

  if (!input.merkleProof) {
    errors.push("Recipient is not included in the eligibility Merkle tree");
    return errors;
  }

  const expectedLeaf = createEligibilityLeaf({
    recipientSecret: input.recipient.recipientSecret,
    identityHash: input.recipient.identityHash,
    leafSalt: input.recipient.leafSalt,
    policyHash: input.campaign.policyHash
  });

  if (expectedLeaf.toLowerCase() !== input.merkleProof.leaf.toLowerCase()) {
    errors.push("Merkle proof leaf does not match recipient witness");
  }

  if (
    !verifyMerkleProofLocally(
      input.merkleProof.leaf,
      input.merkleProof,
      input.campaign.eligibilityRoot
    )
  ) {
    errors.push("Merkle proof does not resolve to campaign eligibility root");
  }

  return errors;
}

export async function generateClaimProof(
  input: GenerateClaimProofInput
): Promise<ClaimProofResult> {
  if (input.mode !== "dev_verifier") {
    throw new Error("Only explicit dev_verifier proof generation is supported here");
  }

  const merkleProof =
    input.proofOverride?.merkleProof ??
    getMerkleProofForRecipient(input.tree, input.recipient);

  const publicInputs = derivePublicInputs({
    campaign: input.campaign,
    recipient: input.recipient,
    amount: input.amount
  });

  const errors = validateClaimWitness({
    campaign: input.campaign,
    recipient: input.recipient,
    amount: input.amount,
    merkleProof
  });

  const ok = errors.length === 0;
  const resultBase = {
    ok,
    mode: "dev_verifier" as const,
    proof: createProofEnvelope(publicInputs, ok),
    publicInputs,
    errors
  };

  if (!merkleProof) {
    return resultBase;
  }

  return {
    ...resultBase,
    privateInputs: createPrivateInputs(input.recipient, merkleProof)
  };
}

export async function verifyClaimProofLocally(
  proof: ClaimProofEnvelope,
  publicInputs: ClaimPublicInputs
): Promise<boolean> {
  if (proof.protocol !== "lumen_claim" || proof.circuitVersion !== "claim_v0") {
    return false;
  }

  if (proof.mode !== "dev_verifier") {
    return false;
  }

  const hash = publicInputsHash(publicInputs);
  return (
    proof.publicInputsHash.toLowerCase() === hash.toLowerCase() &&
    proof.devVerifierDigest?.toLowerCase() === hash.toLowerCase() &&
    proof.proof === `${DEV_PROOF_PREFIX}:${hash}`
  );
}

export function formatPublicInputsForSoroban(
  publicInputs: ClaimPublicInputs
): SorobanClaimPublicInputTuple {
  return {
    campaign_id: publicInputs.campaignId,
    eligibility_root: publicInputs.eligibilityRoot,
    policy_hash: publicInputs.policyHash,
    nullifier_hash: publicInputs.nullifierHash,
    amount_commitment: publicInputs.amountCommitment,
    recipient_commitment: publicInputs.recipientCommitment,
    amount: publicInputs.amount.toString(),
    max_amount: publicInputs.maxAmount.toString()
  };
}

export function encodeProofForSoroban(proof: ClaimProofEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(proof));
}

export function decodeProofFromSoroban(bytes: Uint8Array): ClaimProofEnvelope {
  return JSON.parse(new TextDecoder().decode(bytes)) as ClaimProofEnvelope;
}
