#![no_std]

mod groth16_claim_v0;

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, BytesN, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimPublicInputs {
    pub campaign_id: BytesN<32>,
    pub eligibility_root: BytesN<32>,
    pub policy_hash: BytesN<32>,
    pub nullifier_hash: BytesN<32>,
    pub amount_commitment: BytesN<32>,
    pub recipient_commitment: BytesN<32>,
    pub amount: i128,
    pub max_amount: i128,
}

#[contract]
pub struct VerifierContract;

#[contractimpl]
impl VerifierContract {
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
            policy_hash: bytes32(env, 3),
            nullifier_hash: bytes32(env, 4),
            amount_commitment: bytes32(env, 5),
            recipient_commitment: bytes32(env, 6),
            amount: 100,
            max_amount: 250,
        }
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
