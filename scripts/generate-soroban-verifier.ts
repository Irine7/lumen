import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { artifactPaths, repoRoot } from "../circuits/claim/scripts/zk";

type VerificationKey = {
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
};

type ProofJson = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
};

type PublicInputs = {
  campaignId: string;
  eligibilityRoot: string;
  complianceRoot: string;
  policyHash: string;
  nullifierHash: string;
  amountCommitment: string;
  recipientCommitment: string;
  payoutAccountHash: string;
};

const outputPath = join(repoRoot, "contracts", "verifier", "src", "groth16_claim_v0.rs");
const libPath = join(repoRoot, "contracts", "verifier", "src", "lib.rs");

function bytes32FromDecimal(value: string): number[] {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return [...hex.match(/.{2}/g)!].map((byte) => Number.parseInt(byte, 16));
}

function bytes32FromHex(value: string): number[] {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  return [...clean.padStart(64, "0").match(/.{2}/g)!].map((byte) => Number.parseInt(byte, 16));
}

function g1Bytes(point: string[]): number[] {
  return [...bytes32FromDecimal(point[0]!), ...bytes32FromDecimal(point[1]!)];
}

function g2Bytes(point: string[][]): number[] {
  return [
    ...bytes32FromDecimal(point[0]![1]!),
    ...bytes32FromDecimal(point[0]![0]!),
    ...bytes32FromDecimal(point[1]![1]!),
    ...bytes32FromDecimal(point[1]![0]!)
  ];
}

function proofBytes(proof: ProofJson): number[] {
  return [
    ...bytes32FromDecimal(proof.pi_a[0]),
    ...bytes32FromDecimal(proof.pi_a[1]),
    ...bytes32FromDecimal(proof.pi_b[0][1]),
    ...bytes32FromDecimal(proof.pi_b[0][0]),
    ...bytes32FromDecimal(proof.pi_b[1][1]),
    ...bytes32FromDecimal(proof.pi_b[1][0]),
    ...bytes32FromDecimal(proof.pi_c[0]),
    ...bytes32FromDecimal(proof.pi_c[1])
  ];
}

function rustArray(name: string, length: number, values: number[], visibility = "const"): string {
  if (values.length !== length) {
    throw new Error(`${name} expected ${length} bytes, got ${values.length}`);
  }
  const rows: string[] = [];
  for (let index = 0; index < values.length; index += 16) {
    rows.push(`    ${values.slice(index, index + 16).join(", ")},`);
  }
  return `${visibility} ${name}: [u8; ${length}] = [\n${rows.join("\n")}\n];`;
}

function publicInputScalars(): string[] {
  return [
    "    scalars.push_back(fr_one(env));",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.campaign_id)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.eligibility_root)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.compliance_root)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.policy_hash)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.nullifier_hash)?);",
    "    scalars.push_back(fr_from_i128(env, public_inputs.amount)?);",
    "    scalars.push_back(fr_from_i128(env, public_inputs.max_amount)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.amount_commitment)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.recipient_commitment)?);",
    "    scalars.push_back(fr_from_bytes(env, &public_inputs.payout_account_hash)?);"
  ];
}

function generatedRust(args: {
  vk: VerificationKey;
  proof: ProofJson;
  inputs: PublicInputs;
}): string {
  const vkArrays = [
    rustArray("BN254_FP_MODULUS_BE", 32, [
      48, 100, 78, 114, 225, 49, 160, 41, 184, 80, 69, 182, 129, 129, 88, 93,
      151, 129, 106, 145, 104, 113, 202, 141, 60, 32, 140, 22, 216, 124, 253,
      71
    ]),
    rustArray("BN254_FR_MODULUS_BE", 32, [
      48, 100, 78, 114, 225, 49, 160, 41, 184, 80, 69, 182, 129, 129, 88, 93,
      40, 51, 232, 72, 121, 185, 112, 145, 67, 225, 245, 147, 240, 0, 0, 1
    ]),
    rustArray("VK_ALPHA_G1", 64, g1Bytes(args.vk.vk_alpha_1)),
    rustArray("VK_BETA_G2", 128, g2Bytes(args.vk.vk_beta_2)),
    rustArray("VK_GAMMA_G2", 128, g2Bytes(args.vk.vk_gamma_2)),
    rustArray("VK_DELTA_G2", 128, g2Bytes(args.vk.vk_delta_2)),
    ...args.vk.IC.map((point, index) => rustArray(`VK_IC_${index}`, 64, g1Bytes(point)))
  ];

  const points = args.vk.IC.map((_, index) => `    points.push_back(g1(env, &VK_IC_${index}));`).join("\n");

  return `#![cfg_attr(feature = "dev_verifier", allow(dead_code, unused_imports))]

use crate::ClaimPublicInputs;
use soroban_sdk::{
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    Bytes, BytesN, Env, Vec as SorobanVec,
};

// Generated from circuits/claim/build/verification_key.json after
// \`pnpm zk:setup && pnpm zk:build\` for the deterministic development setup.
const PROOF_LEN: u32 = 256;

${vkArrays.join("\n\n")}

${rustArray("ALICE_PROOF_BYTES", 256, proofBytes(args.proof), "pub(crate) const")}

${rustArray("ALICE_CAMPAIGN_ID_BYTES", 32, bytes32FromHex(args.inputs.campaignId), "pub(crate) const")}

${rustArray("ALICE_ELIGIBILITY_ROOT_BYTES", 32, bytes32FromHex(args.inputs.eligibilityRoot), "pub(crate) const")}

${rustArray("ALICE_COMPLIANCE_ROOT_BYTES", 32, bytes32FromHex(args.inputs.complianceRoot), "pub(crate) const")}

${rustArray("ALICE_POLICY_HASH_BYTES", 32, bytes32FromHex(args.inputs.policyHash), "pub(crate) const")}

${rustArray("ALICE_NULLIFIER_HASH_BYTES", 32, bytes32FromHex(args.inputs.nullifierHash), "pub(crate) const")}

${rustArray("ALICE_AMOUNT_COMMITMENT_BYTES", 32, bytes32FromHex(args.inputs.amountCommitment), "pub(crate) const")}

${rustArray("ALICE_RECIPIENT_COMMITMENT_BYTES", 32, bytes32FromHex(args.inputs.recipientCommitment), "pub(crate) const")}

${rustArray("ALICE_PAYOUT_ACCOUNT_HASH_BYTES", 32, bytes32FromHex(args.inputs.payoutAccountHash), "pub(crate) const")}

pub fn verify_claim(env: &Env, public_inputs: &ClaimPublicInputs, proof: &Bytes) -> bool {
    if proof.len() != PROOF_LEN {
        return false;
    }
    let proof_a = match proof_g1(env, proof, 0) {
        Some(point) => point,
        None => return false,
    };
    let proof_b = match proof_g2(env, proof, 64) {
        Some(point) => point,
        None => return false,
    };
    let proof_c = match proof_g1(env, proof, 192) {
        Some(point) => point,
        None => return false,
    };
    let bn254 = env.crypto().bn254();
    if !bn254.g1_is_on_curve(&proof_a) || !bn254.g1_is_on_curve(&proof_c) {
        return false;
    }
    let vk_x = match compute_vk_x(env, public_inputs) {
        Some(point) => point,
        None => return false,
    };
    let mut g1_points = SorobanVec::new(env);
    g1_points.push_back(-proof_a);
    g1_points.push_back(g1(env, &VK_ALPHA_G1));
    g1_points.push_back(vk_x);
    g1_points.push_back(proof_c);
    let mut g2_points = SorobanVec::new(env);
    g2_points.push_back(proof_b);
    g2_points.push_back(g2(env, &VK_BETA_G2));
    g2_points.push_back(g2(env, &VK_GAMMA_G2));
    g2_points.push_back(g2(env, &VK_DELTA_G2));
    bn254.pairing_check(g1_points, g2_points)
}

fn compute_vk_x(env: &Env, public_inputs: &ClaimPublicInputs) -> Option<Bn254G1Affine> {
    let mut points = SorobanVec::new(env);
${points}
    let mut scalars = SorobanVec::new(env);
${publicInputScalars().join("\n")}
    Some(env.crypto().bn254().g1_msm(points, scalars))
}

fn proof_g1(env: &Env, proof: &Bytes, offset: u32) -> Option<Bn254G1Affine> {
    let mut bytes = [0u8; 64];
    let mut index = 0;
    while index < 64 {
        bytes[index] = proof.get(offset + index as u32)?;
        index += 1;
    }
    if !coords_are_fp(&bytes, 0, 2) {
        return None;
    }
    Some(g1(env, &bytes))
}
fn proof_g2(env: &Env, proof: &Bytes, offset: u32) -> Option<Bn254G2Affine> {
    let mut bytes = [0u8; 128];
    let mut index = 0;
    while index < 128 {
        bytes[index] = proof.get(offset + index as u32)?;
        index += 1;
    }
    if !coords_are_fp(&bytes, 0, 4) {
        return None;
    }
    Some(g2(env, &bytes))
}
fn coords_are_fp<const N: usize>(bytes: &[u8; N], start: usize, count: usize) -> bool {
    let mut coord = 0;
    while coord < count {
        if !slice_less_than(bytes, start + coord * 32, &BN254_FP_MODULUS_BE) {
            return false;
        }
        coord += 1;
    }
    true
}
fn fr_from_bytes(env: &Env, bytes: &BytesN<32>) -> Option<Bn254Fr> {
    let array = bytes.to_array();
    if !array_less_than(&array, &BN254_FR_MODULUS_BE) {
        return None;
    }
    Some(Bn254Fr::from_bytes(BytesN::from_array(env, &array)))
}
fn fr_from_i128(env: &Env, value: i128) -> Option<Bn254Fr> {
    if value < 0 {
        return None;
    }
    let mut bytes = [0u8; 32];
    bytes[16..].copy_from_slice(&(value as u128).to_be_bytes());
    Some(Bn254Fr::from_bytes(BytesN::from_array(env, &bytes)))
}
fn fr_one(env: &Env) -> Bn254Fr {
    let mut bytes = [0u8; 32];
    bytes[31] = 1;
    Bn254Fr::from_bytes(BytesN::from_array(env, &bytes))
}
fn g1(env: &Env, bytes: &[u8; 64]) -> Bn254G1Affine {
    Bn254G1Affine::from_bytes(BytesN::from_array(env, bytes))
}
fn g2(env: &Env, bytes: &[u8; 128]) -> Bn254G2Affine {
    Bn254G2Affine::from_bytes(BytesN::from_array(env, bytes))
}
fn slice_less_than<const N: usize>(bytes: &[u8; N], offset: usize, modulus: &[u8; 32]) -> bool {
    let mut index = 0;
    while index < 32 {
        let byte = bytes[offset + index];
        if byte < modulus[index] {
            return true;
        }
        if byte > modulus[index] {
            return false;
        }
        index += 1;
    }
    false
}
fn array_less_than(bytes: &[u8; 32], modulus: &[u8; 32]) -> bool {
    let mut index = 0;
    while index < 32 {
        if bytes[index] < modulus[index] {
            return true;
        }
        if bytes[index] > modulus[index] {
            return false;
        }
        index += 1;
    }
    false
}
`;
}

async function main(): Promise<void> {
  const vkRaw = await readFile(artifactPaths.verificationKey, "utf8");
  const vk = JSON.parse(vkRaw) as VerificationKey;
  const proof = JSON.parse(await readFile(artifactPaths.aliceProof, "utf8")) as ProofJson;
  const inputs = JSON.parse(await readFile(artifactPaths.aliceNamedPublic, "utf8")) as PublicInputs;
  if (vk.IC.length !== 11) {
    throw new Error(`Expected 11 IC points for 10 public inputs, got ${vk.IC.length}`);
  }
  await writeFile(outputPath, generatedRust({ vk, proof, inputs }), "utf8");

  const hash = createHash("sha256").update(vkRaw).digest();
  const rustBytes = [...hash].map((byte) => `0x${byte.toString(16).padStart(2, "0")}`).join(", ");
  const lib = await readFile(libPath, "utf8");
  const updated = lib.replace(
    /const REAL_VERIFICATION_KEY_HASH_BYTES: \[u8; 32\] = \[[\s\S]*?\];/,
    `const REAL_VERIFICATION_KEY_HASH_BYTES: [u8; 32] = [\n    ${rustBytes},\n];`
  );
  await writeFile(libPath, updated, "utf8");
  console.log(`[ok] wrote ${outputPath}`);
  console.log(`[ok] updated REAL_VERIFICATION_KEY_HASH_BYTES`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
