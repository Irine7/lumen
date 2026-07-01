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
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d, 0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
];

const BN254_FR_MODULUS_BE: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];

const VK_ALPHA_G1: [u8; 64] = [
    9, 230, 142, 79, 38, 38, 192, 94, 232, 69, 247, 150, 189, 48, 153, 100, 128, 10, 21, 12, 116,
    43, 153, 174, 200, 157, 187, 82, 168, 106, 106, 6, 43, 103, 164, 186, 121, 133, 90, 63, 133,
    220, 227, 4, 218, 255, 9, 194, 241, 49, 30, 56, 121, 32, 232, 146, 79, 159, 213, 23, 23, 184,
    99, 147,
];

const VK_BETA_G2: [u8; 128] = [
    25, 86, 66, 90, 142, 230, 224, 174, 82, 13, 13, 155, 203, 194, 79, 93, 57, 208, 230, 66, 129,
    181, 150, 46, 136, 249, 83, 42, 229, 175, 76, 104, 14, 148, 190, 70, 129, 48, 184, 176, 174,
    232, 100, 69, 7, 119, 32, 195, 83, 118, 211, 11, 214, 96, 183, 62, 97, 165, 21, 149, 100, 223,
    141, 230, 0, 69, 159, 193, 57, 107, 110, 27, 28, 200, 238, 246, 220, 254, 69, 133, 152, 102,
    107, 106, 197, 15, 172, 6, 9, 63, 231, 81, 22, 20, 20, 132, 16, 199, 149, 172, 179, 136, 178,
    136, 110, 12, 67, 208, 255, 134, 219, 91, 63, 169, 119, 240, 125, 77, 141, 242, 110, 57, 119,
    119, 206, 8, 137, 244,
];

const VK_GAMMA_G2: [u8; 128] = [
    25, 142, 147, 147, 146, 13, 72, 58, 114, 96, 191, 183, 49, 251, 93, 37, 241, 170, 73, 51, 53,
    169, 231, 18, 151, 228, 133, 183, 174, 243, 18, 194, 24, 0, 222, 239, 18, 31, 30, 118, 66, 106,
    0, 102, 94, 92, 68, 121, 103, 67, 34, 212, 247, 94, 218, 221, 70, 222, 189, 92, 217, 146, 246,
    237, 9, 6, 137, 208, 88, 95, 240, 117, 236, 158, 153, 173, 105, 12, 51, 149, 188, 75, 49, 51,
    112, 179, 142, 243, 85, 172, 218, 220, 209, 34, 151, 91, 18, 200, 94, 165, 219, 140, 109, 235,
    74, 171, 113, 128, 141, 203, 64, 143, 227, 209, 231, 105, 12, 67, 211, 123, 76, 230, 204, 1,
    102, 250, 125, 170,
];

const VK_DELTA_G2: [u8; 128] = [
    21, 89, 57, 230, 22, 173, 109, 40, 146, 155, 158, 180, 180, 16, 106, 112, 49, 225, 99, 163,
    249, 77, 146, 243, 164, 24, 151, 252, 32, 120, 240, 197, 43, 193, 142, 105, 223, 4, 32, 25,
    225, 105, 210, 18, 168, 201, 8, 69, 169, 21, 47, 239, 90, 25, 162, 81, 100, 118, 51, 136, 205,
    99, 38, 122, 1, 93, 70, 184, 57, 207, 133, 203, 37, 39, 101, 157, 38, 195, 248, 79, 96, 169,
    53, 161, 163, 98, 99, 105, 111, 241, 55, 144, 86, 243, 11, 96, 29, 181, 221, 149, 134, 180,
    221, 78, 47, 53, 113, 141, 56, 24, 31, 242, 80, 138, 37, 242, 58, 224, 209, 17, 111, 170, 58,
    253, 34, 160, 61, 131,
];

const VK_IC_0: [u8; 64] = [
    29, 19, 69, 164, 203, 58, 11, 162, 132, 188, 211, 181, 109, 12, 49, 251, 219, 30, 169, 99, 251,
    91, 166, 207, 247, 123, 190, 85, 97, 139, 169, 223, 43, 213, 128, 119, 146, 68, 94, 22, 191,
    159, 128, 23, 170, 15, 206, 82, 174, 134, 100, 162, 124, 53, 32, 158, 58, 198, 246, 37, 40,
    229, 198, 53,
];

const VK_IC_1: [u8; 64] = [
    31, 98, 211, 245, 166, 124, 91, 32, 178, 150, 205, 5, 118, 121, 94, 30, 219, 148, 85, 168, 255,
    219, 177, 142, 86, 94, 119, 174, 184, 176, 122, 111, 36, 183, 191, 43, 213, 205, 92, 198, 182,
    71, 242, 72, 248, 232, 219, 125, 36, 145, 154, 75, 42, 110, 199, 12, 169, 217, 255, 179, 52,
    252, 128, 55,
];

const VK_IC_2: [u8; 64] = [
    26, 177, 54, 89, 16, 121, 103, 231, 16, 132, 220, 11, 45, 130, 94, 134, 252, 64, 4, 228, 94,
    61, 170, 67, 224, 169, 247, 241, 47, 43, 93, 229, 41, 56, 115, 57, 21, 162, 240, 91, 19, 9, 60,
    206, 25, 137, 57, 170, 27, 197, 224, 162, 174, 102, 14, 202, 42, 20, 5, 56, 169, 126, 86, 152,
];

const VK_IC_3: [u8; 64] = [
    35, 46, 148, 157, 140, 198, 84, 26, 134, 160, 235, 117, 113, 5, 86, 132, 198, 133, 3, 120, 217,
    139, 239, 21, 122, 33, 134, 242, 191, 234, 53, 238, 39, 207, 227, 195, 197, 205, 232, 100, 161,
    234, 160, 32, 246, 112, 34, 42, 127, 233, 205, 189, 240, 216, 228, 113, 234, 160, 110, 251, 98,
    29, 253, 225,
];

const VK_IC_4: [u8; 64] = [
    14, 139, 111, 126, 228, 2, 75, 183, 187, 92, 115, 3, 200, 26, 182, 54, 14, 25, 135, 204, 115,
    101, 11, 31, 15, 74, 93, 219, 214, 177, 55, 49, 46, 19, 103, 80, 98, 132, 40, 0, 200, 223, 24,
    179, 157, 124, 119, 66, 128, 5, 154, 21, 107, 195, 191, 102, 88, 184, 241, 117, 238, 243, 145,
    113,
];

const VK_IC_5: [u8; 64] = [
    19, 36, 164, 45, 9, 227, 127, 84, 28, 135, 145, 236, 217, 120, 234, 184, 28, 118, 114, 111, 56,
    58, 146, 16, 8, 172, 83, 150, 108, 250, 246, 156, 46, 141, 125, 105, 222, 246, 34, 46, 41, 7,
    188, 133, 187, 35, 247, 97, 187, 235, 12, 159, 85, 88, 159, 172, 203, 169, 237, 147, 15, 142,
    44, 110,
];

const VK_IC_6: [u8; 64] = [
    12, 188, 79, 108, 255, 212, 121, 5, 189, 158, 226, 41, 121, 239, 184, 218, 66, 56, 135, 185,
    186, 76, 217, 240, 224, 123, 157, 16, 2, 152, 77, 149, 18, 111, 140, 146, 239, 136, 170, 92,
    166, 98, 0, 144, 152, 48, 158, 213, 69, 253, 13, 146, 1, 238, 13, 16, 211, 111, 91, 135, 67,
    107, 17, 11,
];

const VK_IC_7: [u8; 64] = [
    17, 18, 72, 199, 203, 96, 123, 24, 230, 210, 19, 110, 124, 179, 190, 132, 1, 166, 92, 68, 159,
    120, 233, 231, 138, 189, 245, 30, 223, 67, 109, 167, 0, 225, 111, 205, 18, 64, 186, 143, 132,
    219, 9, 114, 14, 6, 118, 175, 213, 20, 38, 97, 28, 44, 236, 65, 12, 195, 216, 119, 127, 106,
    155, 236,
];

const VK_IC_8: [u8; 64] = [
    46, 56, 139, 212, 159, 149, 45, 187, 216, 165, 16, 17, 178, 236, 165, 213, 2, 11, 112, 72, 88,
    135, 213, 199, 13, 197, 9, 2, 172, 31, 88, 74, 26, 137, 197, 234, 163, 35, 66, 88, 94, 233, 36,
    183, 178, 37, 107, 248, 26, 62, 123, 247, 232, 202, 168, 96, 168, 186, 4, 232, 115, 163, 63,
    141,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_PROOF_BYTES: [u8; 256] = [
    47, 67, 237, 194, 227, 134, 137, 25, 48, 212, 178, 185, 14, 37, 186, 124, 71, 188, 67, 164,
    231, 51, 58, 77, 124, 245, 154, 69, 203, 49, 51, 148, 38, 243, 194, 4, 170, 224, 181, 49, 136,
    234, 250, 179, 242, 95, 218, 114, 20, 156, 64, 41, 228, 230, 7, 211, 242, 216, 96, 60, 14, 47,
    111, 198, 11, 22, 98, 175, 153, 113, 21, 73, 161, 54, 27, 236, 224, 108, 104, 89, 254, 30, 243,
    204, 247, 46, 224, 182, 128, 145, 72, 152, 228, 187, 6, 15, 10, 25, 97, 40, 248, 40, 95, 225,
    248, 9, 13, 177, 142, 67, 108, 64, 76, 181, 7, 156, 149, 227, 211, 79, 33, 124, 45, 193, 0, 86,
    33, 46, 10, 2, 26, 41, 124, 57, 55, 124, 15, 41, 197, 62, 74, 218, 20, 25, 251, 147, 94, 49,
    68, 221, 227, 166, 200, 40, 234, 174, 86, 4, 252, 204, 36, 235, 182, 177, 48, 203, 113, 22,
    237, 124, 220, 230, 212, 99, 105, 183, 104, 50, 63, 250, 189, 167, 217, 166, 25, 60, 126, 41,
    86, 227, 210, 188, 26, 16, 13, 105, 238, 97, 72, 52, 173, 72, 131, 227, 92, 255, 159, 28, 196,
    6, 36, 103, 44, 85, 6, 192, 143, 212, 30, 223, 161, 34, 105, 67, 3, 60, 121, 90, 103, 105, 143,
    244, 0, 208, 122, 110, 66, 226, 161, 69, 150, 16, 196, 2, 188, 110, 86, 154, 150, 168, 187,
    236, 46, 207, 234, 44,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_CAMPAIGN_ID_BYTES: [u8; 32] = [
    0, 38, 184, 136, 135, 0, 165, 214, 125, 74, 83, 116, 101, 108, 108, 97, 114, 45, 97, 105, 100,
    45, 114, 97, 105, 108, 115, 45, 48, 48, 49, 1,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_ELIGIBILITY_ROOT_BYTES: [u8; 32] = [
    21, 51, 221, 222, 178, 230, 41, 67, 211, 27, 7, 247, 46, 153, 17, 47, 202, 58, 127, 11, 33,
    197, 128, 78, 162, 113, 19, 200, 230, 13, 115, 122,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_POLICY_HASH_BYTES: [u8; 32] = [
    31, 15, 28, 141, 158, 34, 21, 160, 139, 105, 52, 88, 130, 200, 133, 11, 119, 139, 133, 240, 52,
    111, 2, 199, 194, 166, 16, 245, 29, 65, 170, 33,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_NULLIFIER_HASH_BYTES: [u8; 32] = [
    48, 72, 57, 164, 60, 210, 176, 58, 124, 3, 5, 145, 171, 184, 69, 229, 110, 79, 166, 98, 211,
    15, 37, 64, 101, 109, 247, 184, 37, 136, 124, 102,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_AMOUNT_COMMITMENT_BYTES: [u8; 32] = [
    29, 201, 75, 47, 60, 197, 116, 29, 115, 180, 121, 81, 166, 54, 239, 16, 117, 237, 171, 57, 161,
    111, 95, 152, 56, 81, 194, 192, 221, 86, 170, 162,
];

#[cfg(any(test, feature = "testutils"))]
pub(crate) const ALICE_RECIPIENT_COMMITMENT_BYTES: [u8; 32] = [
    19, 28, 129, 48, 40, 131, 177, 177, 98, 86, 134, 30, 82, 240, 59, 45, 76, 155, 156, 43, 189,
    95, 188, 40, 236, 135, 7, 217, 242, 89, 126, 230,
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

    let mut scalars = SorobanVec::new(env);
    scalars.push_back(fr_one(env));
    scalars.push_back(fr_from_bytes(env, &public_inputs.campaign_id)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.eligibility_root)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.policy_hash)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.nullifier_hash)?);
    scalars.push_back(fr_from_i128(env, public_inputs.amount)?);
    scalars.push_back(fr_from_i128(env, public_inputs.max_amount)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.amount_commitment)?);
    scalars.push_back(fr_from_bytes(env, &public_inputs.recipient_commitment)?);

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
