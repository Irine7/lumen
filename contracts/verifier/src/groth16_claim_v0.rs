#![cfg_attr(feature = "dev_verifier", allow(dead_code, unused_imports))]

use crate::ClaimPublicInputs;
use soroban_sdk::{
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    Bytes, BytesN, Env, Vec as SorobanVec,
};

// Generated from circuits/claim/build/verification_key.json after
// `pnpm zk:setup && pnpm zk:build` for the deterministic development setup.
const PROOF_LEN: u32 = 256;

const BN254_FP_MODULUS_BE: [u8; 32] = [
    48, 100, 78, 114, 225, 49, 160, 41, 184, 80, 69, 182, 129, 129, 88, 93,
    151, 129, 106, 145, 104, 113, 202, 141, 60, 32, 140, 22, 216, 124, 253, 71,
];

const BN254_FR_MODULUS_BE: [u8; 32] = [
    48, 100, 78, 114, 225, 49, 160, 41, 184, 80, 69, 182, 129, 129, 88, 93,
    40, 51, 232, 72, 121, 185, 112, 145, 67, 225, 245, 147, 240, 0, 0, 1,
];

const VK_ALPHA_G1: [u8; 64] = [
    9, 230, 142, 79, 38, 38, 192, 94, 232, 69, 247, 150, 189, 48, 153, 100,
    128, 10, 21, 12, 116, 43, 153, 174, 200, 157, 187, 82, 168, 106, 106, 6,
    43, 103, 164, 186, 121, 133, 90, 63, 133, 220, 227, 4, 218, 255, 9, 194,
    241, 49, 30, 56, 121, 32, 232, 146, 79, 159, 213, 23, 23, 184, 99, 147,
];

const VK_BETA_G2: [u8; 128] = [
    25, 86, 66, 90, 142, 230, 224, 174, 82, 13, 13, 155, 203, 194, 79, 93,
    57, 208, 230, 66, 129, 181, 150, 46, 136, 249, 83, 42, 229, 175, 76, 104,
    14, 148, 190, 70, 129, 48, 184, 176, 174, 232, 100, 69, 7, 119, 32, 195,
    83, 118, 211, 11, 214, 96, 183, 62, 97, 165, 21, 149, 100, 223, 141, 230,
    0, 69, 159, 193, 57, 107, 110, 27, 28, 200, 238, 246, 220, 254, 69, 133,
    152, 102, 107, 106, 197, 15, 172, 6, 9, 63, 231, 81, 22, 20, 20, 132,
    16, 199, 149, 172, 179, 136, 178, 136, 110, 12, 67, 208, 255, 134, 219, 91,
    63, 169, 119, 240, 125, 77, 141, 242, 110, 57, 119, 119, 206, 8, 137, 244,
];

const VK_GAMMA_G2: [u8; 128] = [
    25, 142, 147, 147, 146, 13, 72, 58, 114, 96, 191, 183, 49, 251, 93, 37,
    241, 170, 73, 51, 53, 169, 231, 18, 151, 228, 133, 183, 174, 243, 18, 194,
    24, 0, 222, 239, 18, 31, 30, 118, 66, 106, 0, 102, 94, 92, 68, 121,
    103, 67, 34, 212, 247, 94, 218, 221, 70, 222, 189, 92, 217, 146, 246, 237,
    9, 6, 137, 208, 88, 95, 240, 117, 236, 158, 153, 173, 105, 12, 51, 149,
    188, 75, 49, 51, 112, 179, 142, 243, 85, 172, 218, 220, 209, 34, 151, 91,
    18, 200, 94, 165, 219, 140, 109, 235, 74, 171, 113, 128, 141, 203, 64, 143,
    227, 209, 231, 105, 12, 67, 211, 123, 76, 230, 204, 1, 102, 250, 125, 170,
];

const VK_DELTA_G2: [u8; 128] = [
    21, 89, 57, 230, 22, 173, 109, 40, 146, 155, 158, 180, 180, 16, 106, 112,
    49, 225, 99, 163, 249, 77, 146, 243, 164, 24, 151, 252, 32, 120, 240, 197,
    43, 193, 142, 105, 223, 4, 32, 25, 225, 105, 210, 18, 168, 201, 8, 69,
    169, 21, 47, 239, 90, 25, 162, 81, 100, 118, 51, 136, 205, 99, 38, 122,
    1, 93, 70, 184, 57, 207, 133, 203, 37, 39, 101, 157, 38, 195, 248, 79,
    96, 169, 53, 161, 163, 98, 99, 105, 111, 241, 55, 144, 86, 243, 11, 96,
    29, 181, 221, 149, 134, 180, 221, 78, 47, 53, 113, 141, 56, 24, 31, 242,
    80, 138, 37, 242, 58, 224, 209, 17, 111, 170, 58, 253, 34, 160, 61, 131,
];

const VK_IC_0: [u8; 64] = [
    9, 3, 81, 203, 99, 186, 121, 192, 163, 106, 44, 248, 109, 212, 121, 150,
    248, 158, 19, 24, 15, 15, 93, 12, 128, 150, 167, 240, 92, 255, 46, 186,
    4, 96, 77, 137, 226, 123, 245, 149, 248, 118, 202, 85, 60, 24, 121, 248,
    172, 105, 242, 137, 62, 48, 205, 22, 242, 87, 196, 32, 67, 174, 252, 131,
];

const VK_IC_1: [u8; 64] = [
    41, 177, 187, 16, 75, 105, 19, 144, 25, 58, 35, 142, 179, 104, 191, 80,
    65, 145, 78, 83, 186, 100, 74, 71, 204, 91, 126, 229, 103, 245, 150, 147,
    0, 238, 188, 120, 142, 103, 232, 30, 241, 201, 247, 98, 76, 153, 166, 230,
    153, 92, 240, 216, 91, 13, 206, 220, 56, 161, 155, 209, 195, 73, 112, 53,
];

const VK_IC_2: [u8; 64] = [
    30, 47, 218, 217, 95, 128, 3, 74, 241, 81, 37, 244, 12, 129, 43, 143,
    150, 237, 29, 135, 254, 247, 97, 207, 48, 254, 86, 17, 142, 9, 239, 120,
    28, 182, 248, 105, 229, 148, 119, 95, 26, 60, 123, 114, 124, 103, 38, 105,
    39, 185, 38, 41, 195, 200, 2, 195, 66, 154, 183, 69, 78, 136, 218, 83,
];

const VK_IC_3: [u8; 64] = [
    44, 28, 50, 2, 158, 224, 158, 84, 158, 41, 213, 8, 142, 199, 171, 131,
    224, 60, 1, 150, 170, 157, 177, 222, 140, 15, 27, 225, 229, 201, 193, 223,
    4, 95, 224, 57, 155, 147, 201, 249, 236, 42, 150, 125, 5, 140, 77, 239,
    143, 36, 207, 10, 174, 32, 68, 170, 80, 91, 27, 168, 3, 132, 205, 246,
];

const VK_IC_4: [u8; 64] = [
    47, 127, 222, 86, 131, 255, 144, 3, 182, 207, 167, 85, 213, 175, 186, 253,
    180, 151, 66, 117, 154, 118, 202, 163, 50, 108, 252, 15, 236, 32, 172, 171,
    36, 42, 167, 176, 52, 167, 107, 177, 78, 47, 160, 147, 109, 31, 145, 161,
    121, 183, 22, 8, 62, 157, 55, 80, 86, 125, 192, 233, 66, 87, 234, 133,
];

const VK_IC_5: [u8; 64] = [
    16, 94, 76, 96, 39, 29, 160, 175, 130, 50, 127, 252, 225, 210, 38, 168,
    151, 225, 97, 164, 107, 4, 220, 228, 116, 29, 192, 239, 59, 253, 127, 162,
    13, 16, 194, 177, 22, 149, 5, 222, 108, 91, 93, 195, 7, 215, 59, 177,
    34, 25, 251, 109, 117, 184, 254, 60, 205, 135, 42, 141, 115, 195, 141, 208,
];

const VK_IC_6: [u8; 64] = [
    43, 216, 107, 175, 122, 239, 73, 181, 173, 10, 211, 30, 34, 46, 220, 192,
    108, 47, 145, 3, 51, 119, 194, 78, 140, 143, 158, 25, 227, 121, 66, 148,
    40, 213, 81, 10, 173, 146, 44, 178, 185, 136, 101, 228, 109, 98, 55, 200,
    180, 204, 170, 223, 70, 236, 138, 219, 135, 33, 212, 60, 30, 104, 184, 158,
];

const VK_IC_7: [u8; 64] = [
    4, 185, 112, 114, 177, 175, 198, 213, 218, 115, 47, 193, 43, 47, 79, 93,
    110, 50, 133, 28, 176, 167, 215, 132, 213, 50, 241, 13, 29, 39, 67, 233,
    5, 192, 234, 104, 32, 225, 195, 86, 120, 75, 104, 29, 122, 226, 120, 115,
    32, 73, 99, 50, 141, 52, 214, 187, 232, 214, 115, 246, 185, 136, 29, 237,
];

const VK_IC_8: [u8; 64] = [
    18, 119, 72, 237, 78, 115, 100, 248, 64, 51, 126, 32, 51, 41, 47, 209,
    197, 85, 223, 191, 241, 230, 6, 199, 135, 222, 253, 27, 239, 56, 235, 237,
    37, 91, 68, 167, 29, 8, 113, 93, 142, 101, 110, 140, 112, 196, 240, 43,
    90, 245, 104, 155, 138, 59, 61, 21, 194, 69, 175, 246, 216, 74, 113, 18,
];

const VK_IC_9: [u8; 64] = [
    23, 244, 198, 200, 127, 90, 109, 104, 2, 52, 88, 10, 93, 232, 135, 170,
    163, 182, 162, 227, 249, 63, 152, 36, 111, 219, 147, 95, 9, 220, 22, 93,
    36, 28, 138, 215, 228, 169, 248, 92, 181, 181, 12, 69, 217, 167, 50, 165,
    4, 129, 50, 144, 100, 133, 152, 3, 248, 199, 24, 214, 165, 70, 76, 60,
];

const VK_IC_10: [u8; 64] = [
    33, 59, 61, 142, 225, 25, 127, 197, 240, 53, 123, 110, 221, 52, 121, 176,
    173, 79, 140, 109, 252, 18, 36, 199, 38, 95, 181, 15, 13, 119, 226, 62,
    35, 221, 156, 112, 68, 94, 120, 91, 223, 170, 171, 255, 54, 160, 112, 236,
    4, 38, 182, 39, 220, 74, 217, 166, 11, 69, 73, 115, 188, 184, 167, 160,
];

pub(crate) const ALICE_PROOF_BYTES: [u8; 256] = [
    44, 152, 84, 53, 162, 25, 227, 110, 209, 113, 218, 8, 176, 220, 98, 73,
    133, 114, 39, 44, 70, 163, 153, 224, 237, 57, 28, 52, 113, 236, 173, 164,
    26, 182, 130, 77, 202, 162, 6, 23, 149, 59, 216, 182, 58, 21, 0, 101,
    241, 9, 240, 173, 211, 181, 220, 152, 56, 22, 231, 56, 76, 27, 170, 31,
    32, 41, 178, 209, 135, 45, 181, 78, 80, 215, 76, 134, 97, 92, 82, 174,
    65, 227, 50, 148, 165, 31, 184, 16, 224, 204, 125, 87, 14, 59, 163, 2,
    30, 11, 177, 138, 223, 78, 29, 55, 2, 226, 124, 118, 139, 84, 70, 71,
    125, 129, 55, 196, 159, 26, 209, 18, 39, 235, 221, 134, 230, 79, 41, 234,
    43, 236, 188, 145, 69, 138, 103, 145, 11, 112, 223, 214, 251, 198, 139, 43,
    29, 251, 147, 70, 249, 148, 123, 95, 121, 11, 249, 114, 220, 188, 138, 250,
    24, 186, 221, 98, 165, 70, 183, 36, 76, 244, 36, 29, 57, 22, 248, 55,
    218, 19, 238, 66, 142, 188, 175, 91, 124, 148, 0, 231, 114, 105, 249, 228,
    17, 107, 254, 16, 158, 1, 180, 206, 56, 151, 195, 36, 97, 170, 177, 46,
    51, 60, 19, 18, 145, 103, 9, 128, 61, 137, 233, 96, 120, 159, 206, 174,
    40, 47, 22, 50, 82, 147, 202, 195, 254, 68, 116, 116, 199, 171, 148, 240,
    229, 69, 136, 161, 106, 240, 202, 245, 231, 144, 198, 107, 4, 151, 144, 203,
];

pub(crate) const ALICE_CAMPAIGN_ID_BYTES: [u8; 32] = [
    0, 38, 184, 136, 135, 0, 165, 214, 125, 74, 83, 116, 101, 108, 108, 97,
    114, 45, 97, 105, 100, 45, 114, 97, 105, 108, 115, 45, 48, 48, 49, 1,
];

pub(crate) const ALICE_ELIGIBILITY_ROOT_BYTES: [u8; 32] = [
    43, 7, 9, 132, 55, 119, 48, 205, 25, 203, 38, 63, 101, 167, 172, 224,
    67, 189, 99, 203, 62, 69, 250, 71, 64, 23, 233, 181, 43, 8, 253, 126,
];

pub(crate) const ALICE_COMPLIANCE_ROOT_BYTES: [u8; 32] = [
    10, 33, 56, 83, 124, 240, 60, 63, 114, 102, 127, 26, 52, 54, 182, 89,
    155, 119, 54, 63, 104, 30, 78, 68, 223, 92, 183, 241, 31, 202, 102, 94,
];

pub(crate) const ALICE_POLICY_HASH_BYTES: [u8; 32] = [
    31, 15, 28, 141, 158, 34, 21, 160, 139, 105, 52, 88, 130, 200, 133, 11,
    119, 139, 133, 240, 52, 111, 2, 199, 194, 166, 16, 245, 29, 65, 170, 33,
];

pub(crate) const ALICE_NULLIFIER_HASH_BYTES: [u8; 32] = [
    48, 72, 57, 164, 60, 210, 176, 58, 124, 3, 5, 145, 171, 184, 69, 229,
    110, 79, 166, 98, 211, 15, 37, 64, 101, 109, 247, 184, 37, 136, 124, 102,
];

pub(crate) const ALICE_AMOUNT_COMMITMENT_BYTES: [u8; 32] = [
    29, 201, 75, 47, 60, 197, 116, 29, 115, 180, 121, 81, 166, 54, 239, 16,
    117, 237, 171, 57, 161, 111, 95, 152, 56, 81, 194, 192, 221, 86, 170, 162,
];

pub(crate) const ALICE_RECIPIENT_COMMITMENT_BYTES: [u8; 32] = [
    27, 236, 62, 109, 251, 113, 185, 80, 125, 123, 36, 237, 137, 255, 150, 166,
    190, 185, 241, 102, 201, 74, 159, 250, 12, 173, 58, 254, 202, 123, 156, 245,
];

pub(crate) const ALICE_PAYOUT_ACCOUNT_HASH_BYTES: [u8; 32] = [
    0, 82, 108, 147, 136, 64, 165, 29, 174, 164, 243, 158, 232, 164, 156, 152,
    51, 53, 227, 17, 24, 191, 244, 7, 245, 83, 152, 21, 154, 127, 199, 26,
];

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
    points.push_back(g1(env, &VK_IC_0));
    points.push_back(g1(env, &VK_IC_1));
    points.push_back(g1(env, &VK_IC_2));
    points.push_back(g1(env, &VK_IC_3));
    points.push_back(g1(env, &VK_IC_4));
    points.push_back(g1(env, &VK_IC_5));
    points.push_back(g1(env, &VK_IC_6));
    points.push_back(g1(env, &VK_IC_7));
    points.push_back(g1(env, &VK_IC_8));
    points.push_back(g1(env, &VK_IC_9));
    points.push_back(g1(env, &VK_IC_10));
    let mut scalars = SorobanVec::new(env);
    scalars.push_back(fr_one(env));
    scalars.push_back(fr_from_bytes(env, &public_inputs.campaign_id)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.eligibility_root)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.compliance_root)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.policy_hash)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.nullifier_hash)?);
    scalars.push_back(fr_from_i128(env, public_inputs.amount)?);
    scalars.push_back(fr_from_i128(env, public_inputs.max_amount)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.amount_commitment)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.recipient_commitment)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.payout_account_hash)?);
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
