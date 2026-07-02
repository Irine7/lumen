import type { ClaimPrivateInputs, ClaimPublicInputs, DemoRecipient, Hex32 } from "@lumen-aid/shared";
import {
  buildDemoEligibilityTree,
  createEligibilityLeaf,
  derivePublicInputs,
  getMerkleProofForRecipient,
  toFieldString,
  verifyMerkleProofLocally
} from "@lumen-aid/merkle";
import type {
  BrowserClaimProofWorkerMessage,
  BrowserClaimProofWorkerRequest,
  Groth16Proof
} from "@/lib/zk/types";

type SnarkjsModule = {
  wtns: {
    calculate: (
      input: Record<string, string | string[] | number[]>,
      wasmFileName: string,
      wtns: { type: "mem"; data?: unknown },
      options?: unknown
    ) => Promise<void>;
  };
  groth16: {
    prove: (
      zkeyFileName: string,
      wtns: { type: "mem"; data?: unknown }
    ) => Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
    verify: (
      verificationKey: unknown,
      publicSignals: string[],
      proof: Groth16Proof
    ) => Promise<boolean>;
  };
};

type ZkManifest = {
  wasmPath: string;
  zkeyPath: string;
  verificationKeyPath: string;
};

const DEFAULT_MANIFEST_PATH = "/zk/zk-manifest.json";

function post(message: BrowserClaimProofWorkerMessage): void {
  self.postMessage(message);
}

function field(value: string | number): string {
  return toFieldString(value);
}

function fieldToHex(value: string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeProofForSoroban(proof: Groth16Proof): string {
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

function expectedPublicSignals(publicInputs: ClaimPublicInputs): string[] {
  return [
    field(publicInputs.campaignId),
    field(publicInputs.eligibilityRoot),
    field(publicInputs.policyHash),
    field(publicInputs.nullifierHash),
    publicInputs.amount.toString(),
    publicInputs.maxAmount.toString(),
    field(publicInputs.amountCommitment),
    field(publicInputs.recipientCommitment)
  ];
}

function privateInputsForRecipient(input: {
  campaign: BrowserClaimProofWorkerRequest["campaign"];
  recipient: DemoRecipient;
  recipients: DemoRecipient[];
  publicInputs: ClaimPublicInputs;
}): ClaimPrivateInputs {
  const tree = buildDemoEligibilityTree(input.recipients);
  const merkleProof = getMerkleProofForRecipient(tree, input.recipient);
  if (!merkleProof) {
    throw new Error("Recipient is not included in the active eligibility tree");
  }

  const expectedLeaf = createEligibilityLeaf({
    recipientSecret: input.recipient.recipientSecret,
    identityHash: input.recipient.identityHash,
    leafSalt: input.recipient.leafSalt,
    policyHash: input.campaign.policyHash
  });
  if (expectedLeaf.toLowerCase() !== merkleProof.leaf.toLowerCase()) {
    throw new Error("Recipient witness does not match the Merkle leaf");
  }

  if (!verifyMerkleProofLocally(merkleProof.leaf, merkleProof, input.campaign.eligibilityRoot)) {
    throw new Error("Recipient Merkle path does not resolve to the active testnet root");
  }

  return {
    recipientSecret: input.recipient.recipientSecret,
    identityHash: input.recipient.identityHash,
    leafSalt: input.recipient.leafSalt,
    eligibilityMerklePath: merkleProof.path,
    eligibilityMerkleIndices: merkleProof.indices,
    amountSalt: input.recipient.amountSalt,
    eligibilityReason: input.recipient.eligibilityReason
  };
}

function circuitInputs(
  privateInputs: ClaimPrivateInputs,
  publicInputs: ClaimPublicInputs
): Record<string, string | string[] | number[]> {
  return {
    recipient_secret: field(privateInputs.recipientSecret),
    identity_hash: field(privateInputs.identityHash),
    leaf_salt: field(privateInputs.leafSalt),
    eligibility_merkle_path: privateInputs.eligibilityMerklePath.map((item) => field(item)),
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

function validateRequest(request: BrowserClaimProofWorkerRequest): void {
  if (request.amount <= 0) {
    throw new Error("Claim amount must be positive");
  }
  if (request.amount > request.campaign.perRecipientCap) {
    throw new Error("Claim amount exceeds the active campaign cap");
  }
  if (!request.campaign.isActive) {
    throw new Error("Active testnet campaign is not open");
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function prove(request: BrowserClaimProofWorkerRequest): Promise<void> {
  validateRequest(request);

  post({ type: "status", status: "loading artifacts" });
  const artifactStart = performance.now();
  const manifest = await fetchJson<ZkManifest>(request.manifestPath ?? DEFAULT_MANIFEST_PATH);
  const verificationKey = await fetchJson<unknown>(manifest.verificationKeyPath);
  const artifactLoadMs = performance.now() - artifactStart;

  post({ type: "status", status: "preparing witness" });
  const publicInputs = derivePublicInputs({
    campaign: request.campaign,
    recipient: request.recipient,
    amount: request.amount
  });
  const privateInputs = privateInputsForRecipient({
    campaign: request.campaign,
    recipient: request.recipient,
    recipients: request.recipients,
    publicInputs
  });
  const input = circuitInputs(privateInputs, publicInputs);

  const snarkjs = (await import("snarkjs")) as unknown as SnarkjsModule;
  const witness = { type: "mem" as const };
  const witnessStart = performance.now();
  await snarkjs.wtns.calculate(input, manifest.wasmPath, witness);
  const witnessMs = performance.now() - witnessStart;

  post({ type: "status", status: "generating proof" });
  const proveStart = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.prove(manifest.zkeyPath, witness);
  const proveMs = performance.now() - proveStart;

  const expected = expectedPublicSignals(publicInputs);
  if (JSON.stringify(publicSignals) !== JSON.stringify(expected)) {
    throw new Error("Generated public signals do not match the claim public input order");
  }

  post({ type: "status", status: "verifying proof" });
  const verifyStart = performance.now();
  const localVerification = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  const verifyMs = performance.now() - verifyStart;
  if (!localVerification) {
    throw new Error("Local browser Groth16 verification failed");
  }

  post({ type: "status", status: "ready to submit" });
  post({
    type: "result",
    result: {
      mode: "real_browser_groth16",
      proof,
      publicSignals,
      publicInputs,
      localVerification,
      proofEncodingForSoroban: encodeProofForSoroban(proof),
      timings: {
        artifactLoadMs,
        witnessMs,
        proveMs,
        verifyMs
      }
    }
  });
}

self.onmessage = (event: MessageEvent<BrowserClaimProofWorkerRequest>) => {
  if (event.data.type !== "prove") {
    return;
  }

  prove(event.data).catch((error) => {
    post({ type: "status", status: "failed" });
    post({
      type: "error",
      error: error instanceof Error ? error.message : String(error)
    });
  });
};

export {};

