#![cfg(test)]

use lumen_campaign::{CampaignConfig, CampaignContract, CampaignContractClient};
use lumen_verifier::{test_fixtures, ClaimPublicInputs, VerifierContract};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{Address, Bytes, BytesN, Env};

fn bytes32(env: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(env, &[value; 32])
}

struct Fixture<'a> {
    env: Env,
    client: CampaignContractClient<'a>,
    operator: Address,
    recipient: Address,
    asset: Address,
    config: CampaignConfig,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    env.ledger().set_sequence_number(10);
    let alice_inputs = test_fixtures::alice_public_inputs(&env);

    let operator = Address::generate(&env);
    let recipient = Address::from_str(
        &env,
        "CCMC7BD66YURKZUF5G3UM2BLFBQFOLIQWIHEPBWB5MEMHHH3HBVUPYJB",
    );
    let asset_contract = env.register_stellar_asset_contract_v2(operator.clone());
    let asset = asset_contract.address();
    let stellar_asset = StellarAssetClient::new(&env, &asset);
    stellar_asset.mint(&operator, &1_000);
    let verifier_id = env.register(VerifierContract, ());
    let campaign_id = env.register(CampaignContract, ());
    let client = CampaignContractClient::new(&env, &campaign_id);
    let config = CampaignConfig {
        campaign_id: alice_inputs.campaign_id,
        operator: operator.clone(),
        asset: asset.clone(),
        budget: 1_000,
        per_recipient_cap: 250,
        eligibility_root: alice_inputs.eligibility_root,
        compliance_root: alice_inputs.compliance_root,
        deny_root: None,
        policy_hash: alice_inputs.policy_hash,
        verifier: verifier_id,
        start_ledger: 1,
        end_ledger: 999,
        is_active: true,
    };

    client.initialize(&config);
    client.fund_campaign(&operator, &1_000);

    Fixture {
        env,
        client,
        operator,
        recipient,
        asset,
        config,
    }
}

fn public_inputs(env: &Env, config: &CampaignConfig, amount: i128) -> ClaimPublicInputs {
    let alice_inputs = test_fixtures::alice_public_inputs(env);

    ClaimPublicInputs {
        campaign_id: config.campaign_id.clone(),
        eligibility_root: config.eligibility_root.clone(),
        compliance_root: config.compliance_root.clone(),
        policy_hash: config.policy_hash.clone(),
        nullifier_hash: alice_inputs.nullifier_hash,
        amount_commitment: alice_inputs.amount_commitment,
        recipient_commitment: alice_inputs.recipient_commitment,
        payout_account_hash: alice_inputs.payout_account_hash,
        amount,
        max_amount: config.per_recipient_cap,
    }
}

fn valid_proof(env: &Env, inputs: &ClaimPublicInputs) -> Bytes {
    #[cfg(feature = "dev_verifier")]
    {
        Bytes::from_array(env, &inputs.amount_commitment.to_array())
    }

    #[cfg(not(feature = "dev_verifier"))]
    {
        let _ = inputs;
        test_fixtures::alice_proof(env)
    }
}

fn bad_proof(env: &Env) -> Bytes {
    test_fixtures::proof_with_zero_c(env)
}

fn token_balance(env: &Env, asset: &Address, owner: &Address) -> i128 {
    TokenClient::new(env, asset).balance(owner)
}

#[test]
fn operator_can_initialize_campaign() {
    let fixture = setup();
    let stored = fixture.client.get_campaign();

    assert_eq!(stored.operator, fixture.operator);
    assert_eq!(stored.asset, fixture.asset);
    assert_eq!(stored.eligibility_root, fixture.config.eligibility_root);
    assert_eq!(stored.compliance_root, fixture.config.compliance_root);
    assert_eq!(stored.policy_hash, fixture.config.policy_hash);
    assert_eq!(stored.budget, fixture.config.budget);
    assert_eq!(stored.per_recipient_cap, fixture.config.per_recipient_cap);
    assert_eq!(stored.verifier, fixture.config.verifier);
    assert!(stored.is_active);
    assert_eq!(fixture.client.get_stats().remaining_budget, 1_000);
    assert_eq!(fixture.client.get_escrow_balance(), 1_000);
}

#[test]
#[should_panic]
fn non_operator_auth_cannot_update_roots() {
    let env = Env::default();
    let operator = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(operator.clone())
        .address();
    let verifier_id = env.register(VerifierContract, ());
    let campaign_id = env.register(CampaignContract, ());
    let client = CampaignContractClient::new(&env, &campaign_id);
    let alice_inputs = test_fixtures::alice_public_inputs(&env);
    let config = CampaignConfig {
        campaign_id: alice_inputs.campaign_id,
        operator,
        asset,
        budget: 1_000,
        per_recipient_cap: 250,
        eligibility_root: alice_inputs.eligibility_root,
        compliance_root: alice_inputs.compliance_root,
        deny_root: None,
        policy_hash: alice_inputs.policy_hash,
        verifier: verifier_id,
        start_ledger: 0,
        end_ledger: 999,
        is_active: true,
    };

    client.initialize(&config);
    client.update_roots(&bytes32(&env, 7), &bytes32(&env, 8), &None);
}

#[test]
fn valid_claim_succeeds() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 125);
    let proof = valid_proof(&fixture.env, &inputs);
    let recipient_before = token_balance(&fixture.env, &fixture.asset, &fixture.recipient);
    let escrow_before = fixture.client.get_escrow_balance();

    let result = fixture.client.claim(&inputs, &proof, &fixture.recipient);

    assert!(result.accepted);
    assert_eq!(fixture.client.get_stats().total_claimed, 125);
    assert_eq!(fixture.client.get_stats().claim_count, 1);
    assert_eq!(fixture.client.get_stats().remaining_budget, 875);
    assert_eq!(fixture.client.get_escrow_balance(), escrow_before - 125);
    assert_eq!(
        token_balance(&fixture.env, &fixture.asset, &fixture.recipient),
        recipient_before + 125
    );
    assert!(fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
}

#[test]
fn same_nullifier_claim_fails() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 125);
    let proof = valid_proof(&fixture.env, &inputs);

    fixture.client.claim(&inputs, &proof, &fixture.recipient);
    let recipient_after_first = token_balance(&fixture.env, &fixture.asset, &fixture.recipient);
    let escrow_after_first = fixture.client.get_escrow_balance();
    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    let stats = fixture.client.get_stats();
    assert_eq!(stats.total_claimed, 125);
    assert_eq!(stats.claim_count, 1);
    assert_eq!(
        token_balance(&fixture.env, &fixture.asset, &fixture.recipient),
        recipient_after_first
    );
    assert_eq!(fixture.client.get_escrow_balance(), escrow_after_first);
    assert!(fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
}

#[test]
fn wrong_campaign_id_fails() {
    let fixture = setup();
    let mut inputs = public_inputs(&fixture.env, &fixture.config, 125);
    inputs.campaign_id = bytes32(&fixture.env, 42);
    let proof = valid_proof(&fixture.env, &inputs);

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn wrong_eligibility_root_fails() {
    let fixture = setup();
    let mut inputs = public_inputs(&fixture.env, &fixture.config, 125);
    inputs.eligibility_root = bytes32(&fixture.env, 99);
    let proof = valid_proof(&fixture.env, &inputs);

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn wrong_compliance_root_fails() {
    let fixture = setup();
    let mut inputs = public_inputs(&fixture.env, &fixture.config, 125);
    inputs.compliance_root = bytes32(&fixture.env, 98);
    let proof = valid_proof(&fixture.env, &inputs);

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn wrong_policy_hash_fails() {
    let fixture = setup();
    let mut inputs = public_inputs(&fixture.env, &fixture.config, 125);
    inputs.policy_hash = bytes32(&fixture.env, 99);
    let proof = valid_proof(&fixture.env, &inputs);

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn amount_over_cap_fails() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 251);
    let proof = valid_proof(&fixture.env, &inputs);

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn invalid_verifier_result_does_not_store_nullifier() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 125);
    let proof = bad_proof(&fixture.env);
    let recipient_before = token_balance(&fixture.env, &fixture.asset, &fixture.recipient);
    let escrow_before = fixture.client.get_escrow_balance();

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
    assert_eq!(
        token_balance(&fixture.env, &fixture.asset, &fixture.recipient),
        recipient_before
    );
    assert_eq!(fixture.client.get_escrow_balance(), escrow_before);
}

#[test]
fn wrong_payout_recipient_fails_without_transfer() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 125);
    let proof = valid_proof(&fixture.env, &inputs);
    let wrong_recipient = Address::generate(&fixture.env);
    let wrong_before = token_balance(&fixture.env, &fixture.asset, &wrong_recipient);
    let escrow_before = fixture.client.get_escrow_balance();

    let result = fixture.client.try_claim(&inputs, &proof, &wrong_recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(
        token_balance(&fixture.env, &fixture.asset, &wrong_recipient),
        wrong_before
    );
    assert_eq!(fixture.client.get_escrow_balance(), escrow_before);
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
fn tampered_payout_hash_fails_without_transfer() {
    let fixture = setup();
    let mut inputs = public_inputs(&fixture.env, &fixture.config, 125);
    inputs.payout_account_hash = bytes32(&fixture.env, 88);
    let proof = valid_proof(&fixture.env, &inputs);
    let recipient_before = token_balance(&fixture.env, &fixture.asset, &fixture.recipient);
    let escrow_before = fixture.client.get_escrow_balance();

    let result = fixture
        .client
        .try_claim(&inputs, &proof, &fixture.recipient);

    assert!(result.is_err());
    assert!(!fixture
        .client
        .is_nullifier_used(&inputs.nullifier_hash.clone()));
    assert_eq!(
        token_balance(&fixture.env, &fixture.asset, &fixture.recipient),
        recipient_before
    );
    assert_eq!(fixture.client.get_escrow_balance(), escrow_before);
    assert_eq!(fixture.client.get_stats().total_claimed, 0);
    assert_eq!(fixture.client.get_stats().claim_count, 0);
}

#[test]
#[should_panic]
fn claim_after_close_fails() {
    let fixture = setup();
    let inputs = public_inputs(&fixture.env, &fixture.config, 125);
    let proof = valid_proof(&fixture.env, &inputs);

    fixture.client.close_campaign();
    fixture.client.claim(&inputs, &proof, &fixture.recipient);
}
