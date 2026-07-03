import type {
  CampaignConfig,
  ClaimPublicInputs,
  DemoRecipient,
  Hex32,
  MerkleProof
} from "@lumen-aid/shared";
import { demoCampaignSeed, demoRecipients } from "@lumen-aid/shared";
import { poseidonHash } from "./poseidon";
import { toField, toHex32, ZERO_FIELD, type FieldInput } from "./field";

export interface EligibilityLeafInput {
  recipientSecret: FieldInput;
  identityHash: FieldInput;
  leafSalt: FieldInput;
  policyHash: FieldInput;
}

export interface ComplianceLeafInput {
  recipientSecret: FieldInput;
  identityHash: FieldInput;
  complianceLeafSalt: FieldInput;
  policyHash: FieldInput;
}

export interface EligibilityTree {
  leaves: Hex32[];
  layers: Hex32[][];
  root: Hex32;
}

export interface DemoEligibilityTree extends EligibilityTree {
  eligibleRecipients: DemoRecipient[];
  recipientLeafById: Record<string, Hex32>;
  recipientIndexById: Record<string, number>;
}

export interface DemoComplianceTree extends EligibilityTree {
  compliantRecipients: DemoRecipient[];
  recipientLeafById: Record<string, Hex32>;
  recipientIndexById: Record<string, number>;
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
}

export function createEligibilityLeaf(input: EligibilityLeafInput): Hex32 {
  return poseidonHash([
    input.recipientSecret,
    input.identityHash,
    input.leafSalt,
    input.policyHash
  ]);
}

export function createComplianceLeaf(input: ComplianceLeafInput): Hex32 {
  return poseidonHash([
    input.recipientSecret,
    input.identityHash,
    input.complianceLeafSalt,
    input.policyHash
  ]);
}

export function buildEligibilityTree(leaves: Hex32[], minimumDepth = 3): EligibilityTree {
  if (leaves.length === 0) {
    throw new Error("Cannot build an eligibility tree without leaves");
  }

  const minSize = 2 ** minimumDepth;
  const paddedSize = Math.max(minSize, nextPowerOfTwo(leaves.length));
  const paddedLeaves = [...leaves];

  while (paddedLeaves.length < paddedSize) {
    paddedLeaves.push(ZERO_FIELD);
  }

  const layers: Hex32[][] = [paddedLeaves];

  while (layers[layers.length - 1]!.length > 1) {
    const previous = layers[layers.length - 1]!;
    const next: Hex32[] = [];

    for (let index = 0; index < previous.length; index += 2) {
      const left = previous[index]!;
      const right = previous[index + 1]!;
      next.push(poseidonHash([left, right]));
    }

    layers.push(next);
  }

  return {
    leaves: paddedLeaves,
    layers,
    root: layers[layers.length - 1]![0]!
  };
}

export function getMerkleProof(tree: EligibilityTree, leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Leaf index ${leafIndex} is outside the tree`);
  }

  const path: Hex32[] = [];
  const indices: number[] = [];
  let index = leafIndex;

  for (let depth = 0; depth < tree.layers.length - 1; depth += 1) {
    const layer = tree.layers[depth]!;
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    path.push(layer[siblingIndex] ?? ZERO_FIELD);
    indices.push(isRightNode ? 1 : 0);
    index = Math.floor(index / 2);
  }

  return {
    leaf: tree.leaves[leafIndex]!,
    path,
    indices
  };
}

export function verifyMerkleProofLocally(
  leaf: Hex32,
  proof: Pick<MerkleProof, "path" | "indices">,
  expectedRoot: Hex32
): boolean {
  if (proof.path.length !== proof.indices.length) {
    return false;
  }

  let current = leaf;

  for (let index = 0; index < proof.path.length; index += 1) {
    const sibling = proof.path[index]!;
    const direction = proof.indices[index]!;
    current =
      direction === 0
        ? poseidonHash([current, sibling])
        : poseidonHash([sibling, current]);
  }

  return current.toLowerCase() === expectedRoot.toLowerCase();
}

export function deriveNullifier(recipientSecret: FieldInput, campaignId: FieldInput): Hex32 {
  return poseidonHash([recipientSecret, campaignId]);
}

export function deriveAmountCommitment(
  amount: number,
  amountSalt: FieldInput,
  campaignId: FieldInput
): Hex32 {
  return poseidonHash([amount, amountSalt, campaignId]);
}

export function deriveRecipientCommitment(
  recipientSecret: FieldInput,
  policyHash: FieldInput,
  payoutAccountHash: FieldInput = ZERO_FIELD
): Hex32 {
  return poseidonHash([recipientSecret, policyHash, payoutAccountHash]);
}

export function derivePublicInputs(input: {
  campaign: CampaignConfig;
  recipient: DemoRecipient;
  amount: number;
  payoutAccountHash?: Hex32;
}): ClaimPublicInputs {
  const payoutAccountHash = input.payoutAccountHash ?? ZERO_FIELD;

  return {
    campaignId: input.campaign.campaignId,
    eligibilityRoot: input.campaign.eligibilityRoot,
    complianceRoot: input.campaign.complianceRoot,
    policyHash: input.campaign.policyHash,
    nullifierHash: deriveNullifier(
      input.recipient.recipientSecret,
      input.campaign.campaignId
    ),
    amountCommitment: deriveAmountCommitment(
      input.amount,
      input.recipient.amountSalt,
      input.campaign.campaignId
    ),
    recipientCommitment: deriveRecipientCommitment(
      input.recipient.recipientSecret,
      input.campaign.policyHash,
      payoutAccountHash
    ),
    payoutAccountHash,
    amount: input.amount,
    maxAmount: input.campaign.perRecipientCap
  };
}

export function buildDemoEligibilityTree(
  recipients: DemoRecipient[] = demoRecipients
): DemoEligibilityTree {
  const eligibleRecipients = recipients.filter((recipient) => recipient.eligible);
  const recipientLeafById: Record<string, Hex32> = {};
  const recipientIndexById: Record<string, number> = {};

  const leaves = eligibleRecipients.map((recipient, index) => {
    const leaf = createEligibilityLeaf({
      recipientSecret: recipient.recipientSecret,
      identityHash: recipient.identityHash,
      leafSalt: recipient.leafSalt,
      policyHash: demoCampaignSeed.policyHash
    });

    recipientLeafById[recipient.id] = leaf;
    recipientIndexById[recipient.id] = index;
    return leaf;
  });

  const tree = buildEligibilityTree(leaves);

  return {
    ...tree,
    eligibleRecipients,
    recipientLeafById,
    recipientIndexById
  };
}

export function buildDemoComplianceTree(
  recipients: DemoRecipient[] = demoRecipients
): DemoComplianceTree {
  const compliantRecipients = recipients.filter((recipient) => recipient.compliant);
  const recipientLeafById: Record<string, Hex32> = {};
  const recipientIndexById: Record<string, number> = {};

  const leaves = compliantRecipients.map((recipient, index) => {
    const leaf = createComplianceLeaf({
      recipientSecret: recipient.recipientSecret,
      identityHash: recipient.identityHash,
      complianceLeafSalt: recipient.complianceLeafSalt,
      policyHash: demoCampaignSeed.policyHash
    });

    recipientLeafById[recipient.id] = leaf;
    recipientIndexById[recipient.id] = index;
    return leaf;
  });

  const tree = buildEligibilityTree(leaves);

  return {
    ...tree,
    compliantRecipients,
    recipientLeafById,
    recipientIndexById
  };
}

export function getMerkleProofForRecipient(
  tree: DemoEligibilityTree | DemoComplianceTree,
  recipient: DemoRecipient
): MerkleProof | null {
  const index = tree.recipientIndexById[recipient.id];
  if (index === undefined) {
    return null;
  }

  return getMerkleProof(tree, index);
}

export function createDemoCampaignConfig(
  tree: EligibilityTree = buildDemoEligibilityTree(),
  complianceTree: EligibilityTree = buildDemoComplianceTree()
): CampaignConfig {
  return {
    ...demoCampaignSeed,
    eligibilityRoot: tree.root,
    complianceRoot: complianceTree.root
  };
}

export function publicInputsHash(publicInputs: ClaimPublicInputs): Hex32 {
  return poseidonHash([
    publicInputs.campaignId,
    publicInputs.eligibilityRoot,
    publicInputs.complianceRoot,
    publicInputs.policyHash,
    publicInputs.nullifierHash,
    publicInputs.amount,
    publicInputs.maxAmount,
    publicInputs.amountCommitment,
    publicInputs.recipientCommitment,
    publicInputs.payoutAccountHash
  ]);
}

export function fieldDebug(value: FieldInput): { decimal: string; hex: Hex32 } {
  const field = toField(value);
  return {
    decimal: field.toString(),
    hex: toHex32(field)
  };
}
