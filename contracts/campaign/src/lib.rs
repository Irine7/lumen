#![no_std]

use lumen_verifier::ClaimPublicInputs;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Bytes, BytesN, Env, IntoVal, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignConfig {
    pub campaign_id: BytesN<32>,
    pub operator: Address,
    pub asset: Address,
    pub budget: i128,
    pub per_recipient_cap: i128,
    pub eligibility_root: BytesN<32>,
    pub deny_root: Option<BytesN<32>>,
    pub policy_hash: BytesN<32>,
    pub verifier: Address,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignStats {
    pub total_claimed: i128,
    pub claim_count: u32,
    pub remaining_budget: i128,
    pub duplicate_claims_blocked: u32,
    pub invalid_claims_blocked: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimResult {
    pub accepted: bool,
    pub amount: i128,
    pub total_claimed: i128,
    pub claim_count: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Stats,
    Nullifier(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CampaignError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CampaignClosed = 3,
    LedgerOutOfRange = 4,
    WrongEligibilityRoot = 5,
    WrongPolicyHash = 6,
    WrongMaxAmount = 7,
    AmountOverCap = 8,
    InsufficientBudget = 9,
    DuplicateNullifier = 10,
    InvalidProof = 11,
    WrongCampaignId = 12,
}

#[contract]
pub struct CampaignContract;

#[contractimpl]
impl CampaignContract {
    pub fn initialize(env: Env, config: CampaignConfig) -> BytesN<32> {
        if env.storage().instance().has(&DataKey::Config) {
            panic_with_error!(&env, CampaignError::AlreadyInitialized);
        }

        config.operator.require_auth();

        let stats = CampaignStats {
            total_claimed: 0,
            claim_count: 0,
            remaining_budget: config.budget,
            duplicate_claims_blocked: 0,
            invalid_claims_blocked: 0,
        };
        let campaign_id = config.campaign_id.clone();

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Stats, &stats);
        env.events()
            .publish((symbol_short!("init"),), campaign_id.clone());

        campaign_id
    }

    pub fn claim(env: Env, public_inputs: ClaimPublicInputs, proof: Bytes) -> ClaimResult {
        let config = read_config(&env);
        let mut stats = read_stats(&env);
        let ledger = env.ledger().sequence();

        if !config.is_active {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::CampaignClosed);
        }

        if ledger < config.start_ledger || ledger > config.end_ledger {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::LedgerOutOfRange);
        }

        if public_inputs.campaign_id != config.campaign_id {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::WrongCampaignId);
        }

        if public_inputs.eligibility_root != config.eligibility_root {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::WrongEligibilityRoot);
        }

        if public_inputs.policy_hash != config.policy_hash {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::WrongPolicyHash);
        }

        if public_inputs.max_amount != config.per_recipient_cap {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::WrongMaxAmount);
        }

        if public_inputs.amount > config.per_recipient_cap {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::AmountOverCap);
        }

        if stats.remaining_budget < public_inputs.amount {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::InsufficientBudget);
        }

        if Self::is_nullifier_used(env.clone(), public_inputs.nullifier_hash.clone()) {
            stats.duplicate_claims_blocked += 1;
            env.storage().instance().set(&DataKey::Stats, &stats);
            env.events().publish(
                (symbol_short!("dupe"),),
                public_inputs.nullifier_hash.clone(),
            );
            panic_with_error!(&env, CampaignError::DuplicateNullifier);
        }

        let verifier_ok: bool = env.invoke_contract(
            &config.verifier,
            &Symbol::new(&env, "verify_claim"),
            (public_inputs.clone(), proof).into_val(&env),
        );

        if !verifier_ok {
            increment_invalid(&env, &mut stats);
            panic_with_error!(&env, CampaignError::InvalidProof);
        }

        env.storage().instance().set(
            &DataKey::Nullifier(public_inputs.nullifier_hash.clone()),
            &true,
        );

        stats.total_claimed += public_inputs.amount;
        stats.claim_count += 1;
        stats.remaining_budget -= public_inputs.amount;
        env.storage().instance().set(&DataKey::Stats, &stats);

        env.events().publish(
            (symbol_short!("claim"), public_inputs.nullifier_hash.clone()),
            public_inputs.amount,
        );

        ClaimResult {
            accepted: true,
            amount: public_inputs.amount,
            total_claimed: stats.total_claimed,
            claim_count: stats.claim_count,
        }
    }

    pub fn get_campaign(env: Env) -> CampaignConfig {
        read_config(&env)
    }

    pub fn get_stats(env: Env) -> CampaignStats {
        read_stats(&env)
    }

    pub fn is_nullifier_used(env: Env, nullifier_hash: BytesN<32>) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Nullifier(nullifier_hash))
            .unwrap_or(false)
    }

    pub fn update_roots(
        env: Env,
        new_eligibility_root: BytesN<32>,
        new_deny_root: Option<BytesN<32>>,
    ) {
        let mut config = read_config(&env);
        config.operator.require_auth();
        config.eligibility_root = new_eligibility_root;
        config.deny_root = new_deny_root;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events()
            .publish((symbol_short!("roots"),), config.eligibility_root);
    }

    pub fn close_campaign(env: Env) {
        let mut config = read_config(&env);
        config.operator.require_auth();
        config.is_active = false;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish((symbol_short!("close"),), ());
    }
}

fn read_config(env: &Env) -> CampaignConfig {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or_else(|| panic_with_error!(env, CampaignError::NotInitialized))
}

fn read_stats(env: &Env) -> CampaignStats {
    env.storage()
        .instance()
        .get(&DataKey::Stats)
        .unwrap_or_else(|| panic_with_error!(env, CampaignError::NotInitialized))
}

fn increment_invalid(env: &Env, stats: &mut CampaignStats) {
    stats.invalid_claims_blocked += 1;
    env.storage().instance().set(&DataKey::Stats, stats);
}
