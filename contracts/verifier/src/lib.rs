#![no_std]

mod groth16_claim_v0;

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, BytesN, Env, Symbol};

const VERIFIER_ID_BYTES: [u8; 32] = [
    0xa9, 0x4e, 0xd2, 0x52, 0x7a, 0xbc, 0xae, 0x4a, 0xe9, 0x78, 0x96, 0x0c, 0x7f, 0x82, 0x14, 0x20,
    0x7c, 0x91, 0xef, 0xfc, 0x5d, 0x26, 0xe6, 0xc3, 0x61, 0xe1, 0xc9, 0x03, 0x56, 0x86, 0x0c, 0x32,
];

const CIRCUIT_ID_BYTES: [u8; 32] = [
    0x08, 0x60, 0x3c, 0xc4, 0x1a, 0xc9, 0xb9, 0x90, 0xfc, 0x5f, 0xf0, 0xb8, 0xe0, 0x36, 0x73, 0xb9,
    0xda, 0xb1, 0x4c, 0x54, 0x20, 0x2d, 0xde, 0xf9, 0x3e, 0x70, 0x8e, 0xf9, 0xa3, 0xf5, 0x8f, 0xbc,
];

#[cfg(not(feature = "dev_verifier"))]
const REAL_VERIFICATION_KEY_HASH_BYTES: [u8; 32] = [
    0xf3, 0xbe, 0x02, 0x65, 0x17, 0x56, 0x96, 0xa6, 0xec, 0xc1, 0x53, 0x0a, 0xd5, 0x78, 0x9f, 0x1a, 0xc0, 0xe0, 0xe8, 0x99, 0xde, 0xe4, 0x9f, 0xf0, 0x66, 0xa0, 0x49, 0x54, 0x5d, 0xb6, 0x4e, 0x92,
];

#[cfg(feature = "dev_verifier")]
const DEV_VERIFICATION_KEY_HASH_BYTES: [u8; 32] = [
    0xf4, 0xfb, 0x87, 0x8a, 0xa7, 0xde, 0xa2, 0xc3, 0xcf, 0x12, 0xec, 0x9e, 0x7a, 0xc4, 0xd2, 0x48,
    0x7e, 0x4f, 0xc3, 0x60, 0xf1, 0x5d, 0x4d, 0x1b, 0x0d, 0xb6, 0x8c, 0xeb, 0xf6, 0xc8, 0xa1, 0xfd,
];

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimPublicInputs {
    pub campaign_id: BytesN<32>,
    pub eligibility_root: BytesN<32>,
    pub compliance_root: BytesN<32>,
    pub policy_hash: BytesN<32>,
    pub nullifier_hash: BytesN<32>,
    pub amount_commitment: BytesN<32>,
    pub recipient_commitment: BytesN<32>,
    pub payout_account_hash: BytesN<32>,
    pub amount: i128,
    pub max_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VerifierInfo {
    pub verifier_id: BytesN<32>,
    pub circuit_id: BytesN<32>,
    pub verification_key_hash: BytesN<32>,
    pub mode: Symbol,
    pub version: Symbol,
}

#[contract]
pub struct VerifierContract;

#[contractimpl]
impl VerifierContract {
    pub fn verifier_info(env: Env) -> VerifierInfo {
        VerifierInfo {
            verifier_id: BytesN::from_array(&env, &VERIFIER_ID_BYTES),
            circuit_id: BytesN::from_array(&env, &CIRCUIT_ID_BYTES),
            verification_key_hash: BytesN::from_array(&env, verification_key_hash_bytes()),
            mode: Symbol::new(&env, verifier_mode()),
            version: Symbol::new(&env, "claim_v0"),
        }
    }

    pub fn verify_claim(env: Env, public_inputs: ClaimPublicInputs, proof: Bytes) -> bool {
        #[cfg(feature = "dev_verifier")]
        {
            return verify_dev_proof(&env, &public_inputs, &proof);
        }

        #[cfg(not(feature = "dev_verifier"))]
        {
            groth16_claim_v0::verify_claim(&env, &public_inputs, &proof)
        }
    }
}

#[cfg(feature = "dev_verifier")]
fn verifier_mode() -> &'static str {
    "dev_verifier"
}

#[cfg(not(feature = "dev_verifier"))]
fn verifier_mode() -> &'static str {
    "real_groth16"
}

#[cfg(feature = "dev_verifier")]
fn verification_key_hash_bytes() -> &'static [u8; 32] {
    &DEV_VERIFICATION_KEY_HASH_BYTES
}

#[cfg(not(feature = "dev_verifier"))]
fn verification_key_hash_bytes() -> &'static [u8; 32] {
    &REAL_VERIFICATION_KEY_HASH_BYTES
}

#[cfg(feature = "dev_verifier")]
fn verify_dev_proof(_env: &Env, public_inputs: &ClaimPublicInputs, proof: &Bytes) -> bool {
    if proof.len() != 32 {
        return false;
    }

    for index in 0..32 {
        if proof.get(index).unwrap_or(255) != public_inputs.amount_commitment.get(index).unwrap() {
            return false;
        }
    }

    true
}

#[cfg(any(test, feature = "testutils"))]
pub mod test_fixtures {
    use super::{groth16_claim_v0, ClaimPublicInputs};
    use soroban_sdk::{Bytes, BytesN, Env};

    pub fn alice_public_inputs(env: &Env) -> ClaimPublicInputs {
        ClaimPublicInputs {
            campaign_id: BytesN::from_array(env, &groth16_claim_v0::ALICE_CAMPAIGN_ID_BYTES),
            eligibility_root: BytesN::from_array(
                env,
                &groth16_claim_v0::ALICE_ELIGIBILITY_ROOT_BYTES,
            ),
            compliance_root: BytesN::from_array(
                env,
                &groth16_claim_v0::ALICE_COMPLIANCE_ROOT_BYTES,
            ),
            policy_hash: BytesN::from_array(env, &groth16_claim_v0::ALICE_POLICY_HASH_BYTES),
            nullifier_hash: BytesN::from_array(env, &groth16_claim_v0::ALICE_NULLIFIER_HASH_BYTES),
            amount_commitment: BytesN::from_array(
                env,
                &groth16_claim_v0::ALICE_AMOUNT_COMMITMENT_BYTES,
            ),
            recipient_commitment: BytesN::from_array(
                env,
                &groth16_claim_v0::ALICE_RECIPIENT_COMMITMENT_BYTES,
            ),
            payout_account_hash: BytesN::from_array(
                env,
                &groth16_claim_v0::ALICE_PAYOUT_ACCOUNT_HASH_BYTES,
            ),
            amount: 125,
            max_amount: 250,
        }
    }

    pub fn alice_proof(env: &Env) -> Bytes {
        Bytes::from_array(env, &groth16_claim_v0::ALICE_PROOF_BYTES)
    }

    pub fn malformed_proof(env: &Env) -> Bytes {
        Bytes::from_slice(env, &[1, 2, 3])
    }

    pub fn zero_proof(env: &Env) -> Bytes {
        Bytes::from_array(env, &[0; 256])
    }

    pub fn proof_with_zero_c(env: &Env) -> Bytes {
        let mut proof = groth16_claim_v0::ALICE_PROOF_BYTES;
        let mut index = 192;
        while index < 256 {
            proof[index] = 0;
            index += 1;
        }
        Bytes::from_array(env, &proof)
    }

    pub fn dev_proof(env: &Env, inputs: &ClaimPublicInputs) -> Bytes {
        Bytes::from_array(env, &inputs.amount_commitment.to_array())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{BytesN, Env};

    fn bytes32(env: &Env, value: u8) -> BytesN<32> {
        BytesN::from_array(env, &[value; 32])
    }

    #[cfg(feature = "dev_verifier")]
    fn public_inputs(env: &Env) -> ClaimPublicInputs {
        ClaimPublicInputs {
            campaign_id: bytes32(env, 1),
            eligibility_root: bytes32(env, 2),
            compliance_root: bytes32(env, 3),
            policy_hash: bytes32(env, 4),
            nullifier_hash: bytes32(env, 5),
            amount_commitment: bytes32(env, 6),
            recipient_commitment: bytes32(env, 7),
            payout_account_hash: bytes32(env, 8),
            amount: 100,
            max_amount: 250,
        }
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn default_verifier_info_reports_real_groth16() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);

        let info = client.verifier_info();

        assert_eq!(info.mode, Symbol::new(&env, "real_groth16"));
        assert_eq!(info.version, Symbol::new(&env, "claim_v0"));
        assert_eq!(
            info.verification_key_hash,
            BytesN::from_array(&env, &REAL_VERIFICATION_KEY_HASH_BYTES)
        );
    }

    #[test]
    #[cfg(feature = "dev_verifier")]
    fn dev_verifier_info_reports_dev_verifier() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);

        let info = client.verifier_info();

        assert_eq!(info.mode, Symbol::new(&env, "dev_verifier"));
        assert_eq!(info.version, Symbol::new(&env, "claim_v0"));
        assert_eq!(
            info.verification_key_hash,
            BytesN::from_array(&env, &DEV_VERIFICATION_KEY_HASH_BYTES)
        );
    }

    #[test]
    fn verifier_info_is_stable_across_calls() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);

        assert_eq!(client.verifier_info(), client.verifier_info());
    }

    #[test]
    fn malformed_proof_rejected() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);

        let proof = test_fixtures::malformed_proof(&env);

        assert!(!client.verify_claim(&test_fixtures::alice_public_inputs(&env), &proof));
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn real_verifier_accepts_alice_proof() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let inputs = test_fixtures::alice_public_inputs(&env);
        let proof = test_fixtures::alice_proof(&env);

        assert!(client.verify_claim(&inputs, &proof));
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn real_verifier_rejects_invalid_proof() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let inputs = test_fixtures::alice_public_inputs(&env);
        let proof = test_fixtures::zero_proof(&env);

        assert!(!client.verify_claim(&inputs, &proof));
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn real_verifier_rejects_tampered_public_input() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let mut inputs = test_fixtures::alice_public_inputs(&env);
        inputs.campaign_id = bytes32(&env, 7);
        let proof = test_fixtures::alice_proof(&env);

        assert!(!client.verify_claim(&inputs, &proof));
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn real_verifier_rejects_tampered_proof() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let inputs = test_fixtures::alice_public_inputs(&env);
        let proof = test_fixtures::proof_with_zero_c(&env);

        assert!(!client.verify_claim(&inputs, &proof));
    }

    #[test]
    #[cfg(not(feature = "dev_verifier"))]
    fn dev_proof_rejected_without_dev_feature() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let inputs = test_fixtures::alice_public_inputs(&env);
        let proof = test_fixtures::dev_proof(&env, &inputs);

        assert!(!client.verify_claim(&inputs, &proof));
    }

    #[test]
    #[cfg(feature = "dev_verifier")]
    fn dev_verifier_accepts_expected_dev_digest() {
        let env = Env::default();
        let contract_id = env.register(VerifierContract, ());
        let client = VerifierContractClient::new(&env, &contract_id);
        let inputs = public_inputs(&env);
        let proof = soroban_sdk::Bytes::from_array(&env, &inputs.amount_commitment.to_array());

        assert!(client.verify_claim(&inputs, &proof));
    }
}
