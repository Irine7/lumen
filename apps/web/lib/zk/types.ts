import type {
  CampaignConfig,
  ClaimPublicInputs,
  DemoRecipient,
  Hex32
} from "@lumen-aid/shared";

export type Groth16Proof = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol?: string;
  curve?: string;
};

export type BrowserProofStatus =
  | "loading artifacts"
  | "preparing witness"
  | "generating proof"
  | "verifying proof"
  | "ready to submit"
  | "failed";

export type BrowserClaimProofResult = {
  mode: "real_browser_groth16";
  proof: Groth16Proof;
  publicSignals: string[];
  publicInputs: ClaimPublicInputs;
  localVerification: boolean;
  proofEncodingForSoroban: string;
  timings: {
    artifactLoadMs: number;
    witnessMs: number;
    proveMs: number;
    verifyMs: number;
  };
};

export type BrowserClaimProofRequest = {
  campaign: CampaignConfig;
  recipient: DemoRecipient;
  recipients: DemoRecipient[];
  amount: number;
  payoutAddress?: string;
  payoutAccountHash?: Hex32;
  manifestPath?: string;
};

export type BrowserClaimProofWorkerRequest = BrowserClaimProofRequest & {
  type: "prove";
};

export type BrowserClaimProofWorkerMessage =
  | {
      type: "status";
      status: BrowserProofStatus;
    }
  | {
      type: "result";
      result: BrowserClaimProofResult;
    }
  | {
      type: "error";
      error: string;
    };
