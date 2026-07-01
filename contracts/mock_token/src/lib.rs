#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Balance(Address),
}

#[contract]
pub struct MockTokenContract;

#[contractimpl]
impl MockTokenContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let current = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&DataKey::Balance(to), &(current + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn mints_demo_balances() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);
        let contract_id = env.register(MockTokenContract, ());
        let client = MockTokenContractClient::new(&env, &contract_id);

        client.initialize(&admin);
        client.mint(&recipient, &100);

        assert_eq!(client.balance(&recipient), 100);
    }
}
