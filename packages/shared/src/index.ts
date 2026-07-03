export type Hex32 = `0x${string}`;

export type FieldElement = string;

export type ProofMode = "groth16" | "dev_verifier";

export interface DemoRecipient {
  id: "alice" | "bob" | "charlie" | "dora" | "eve" | "mallory";
  displayName: string;
  eligibilityReason: string;
  complianceStatus: "cleared" | "not_cleared";
  eligible: boolean;
  compliant: boolean;
  recipientSecret: FieldElement;
  identityHash: FieldElement;
  leafSalt: FieldElement;
  complianceLeafSalt: FieldElement;
  amountSalt: FieldElement;
  defaultClaimAmount: number;
  payoutAddress?: string;
}

export interface CampaignConfig {
  campaignId: Hex32;
  name: string;
  operator: string;
  asset: string;
  budget: number;
  perRecipientCap: number;
  eligibilityRoot: Hex32;
  complianceRoot: Hex32;
  denyRoot: Hex32 | null;
  policyHash: Hex32;
  verifier: string;
  startLedger: number;
  endLedger: number;
  isActive: boolean;
}

export interface CampaignStats {
  totalClaimed: number;
  claimCount: number;
  remainingBudget: number;
  duplicateClaimsBlocked: number;
  invalidClaimsBlocked: number;
  lastEvent: CampaignEvent | null;
}

export type CampaignEventType =
  | "campaign_created"
  | "campaign_funded"
  | "campaign_initialized"
  | "claim_verified"
  | "payout_sent"
  | "claim_accepted"
  | "duplicate_rejected"
  | "invalid_rejected"
  | "campaign_closed"
  | "roots_updated";

export interface CampaignEvent {
  type: CampaignEventType;
  at: string;
  nullifierHash?: Hex32;
  amount?: number;
  message: string;
}

export interface MerkleProof {
  leaf: Hex32;
  path: Hex32[];
  indices: number[];
}

export interface ClaimPrivateInputs {
  recipientSecret: FieldElement;
  identityHash: FieldElement;
  leafSalt: FieldElement;
  eligibilityMerklePath: Hex32[];
  eligibilityMerkleIndices: number[];
  complianceLeafSalt: FieldElement;
  complianceMerklePath: Hex32[];
  complianceMerkleIndices: number[];
  amountSalt: FieldElement;
  eligibilityReason: string;
  complianceStatus: DemoRecipient["complianceStatus"];
}

export interface ClaimPublicInputs {
  campaignId: Hex32;
  eligibilityRoot: Hex32;
  complianceRoot: Hex32;
  policyHash: Hex32;
  nullifierHash: Hex32;
  amountCommitment: Hex32;
  recipientCommitment: Hex32;
  payoutAccountHash: Hex32;
  amount: number;
  maxAmount: number;
}

export interface ClaimProofEnvelope {
  protocol: "lumen_claim";
  circuitVersion: "claim_v0";
  mode: ProofMode;
  devVerifierDigest?: Hex32;
  proof: string;
  publicInputsHash: Hex32;
}

export interface ClaimProofResult {
  ok: boolean;
  mode: ProofMode;
  proof: ClaimProofEnvelope;
  publicInputs: ClaimPublicInputs;
  privateInputs?: ClaimPrivateInputs;
  errors: string[];
}

export type ClaimUiStatus =
  | "idle"
  | "generating_proof"
  | "proof_generated"
  | "submitting"
  | "verified"
  | "accepted"
  | "duplicate_rejected"
  | "invalid_rejected";

export const LUMEN_PROTOCOL_VERSION = "lumen-aid-demo-v0";

export * from "./demo/recipients";
