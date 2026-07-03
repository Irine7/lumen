# Compliance Flow

## Scope

Lumen's compliance MVP proves positive membership in a compliance clearance root. It does not implement general deny-list non-membership and does not integrate a real KYC, sanctions, or compliance provider.

## Campaign Configuration

A compliance-aware campaign is configured with:

```txt
campaign_id
eligibility_root
compliance_root
policy_hash
asset
budget
per_recipient_cap
start_ledger
end_ledger
verifier
```

`policy_hash` is a public commitment to the campaign policy and demo provider scope. For this MVP, the compliance provider hash is folded into `policy_hash` instead of adding a separate public input.

## Demo Recipients

| Recipient | Eligibility | Compliance clearance | Expected result |
| --- | --- | --- | --- |
| Alice | eligible | cleared | claim can pass once |
| Bob | eligible | cleared | claim can pass once |
| Charlie | eligible | cleared | claim can pass once |
| Dora | eligible | cleared | claim can pass once |
| Eve | eligible | not cleared | proof generation fails |
| Mallory | not eligible | not cleared | proof generation fails |

The recipient UI may show demo fixture badges, but eligibility details, compliance details, salts, secrets, and Merkle paths remain hidden unless Debug mode is explicitly enabled.

## Circuit Statement

The recipient proves:

```txt
eligibility_leaf = Poseidon(recipient_secret, identity_hash, leaf_salt, policy_hash)
computed_eligibility_root = MerkleRoot(eligibility_leaf, eligibility_merkle_path, eligibility_merkle_indices)
computed_eligibility_root == eligibility_root

compliance_leaf = Poseidon(recipient_secret, identity_hash, compliance_leaf_salt, policy_hash)
computed_compliance_root = MerkleRoot(compliance_leaf, compliance_merkle_path, compliance_merkle_indices)
computed_compliance_root == compliance_root

nullifier_hash = Poseidon(recipient_secret, campaign_id)
amount <= max_amount
amount_commitment = Poseidon(amount, amount_salt, campaign_id)
recipient_commitment = Poseidon(recipient_secret, policy_hash, payout_account_hash)
```

Public inputs:

```txt
campaign_id
eligibility_root
compliance_root
policy_hash
nullifier_hash
amount
max_amount
amount_commitment
recipient_commitment
payout_account_hash
```

Private witness values, expanded for the fixed-depth demo trees:

```txt
recipient_secret
identity_hash
leaf_salt
eligibility_merkle_path[0..2]
eligibility_merkle_indices[0..2]
compliance_leaf_salt
compliance_merkle_path[0..2]
compliance_merkle_indices[0..2]
amount_salt
```

That is 17 expanded private witness fields and 10 public inputs.

## Contract Checks

The campaign claim path rejects:

- wrong campaign ID,
- wrong eligibility root,
- wrong compliance root,
- wrong policy hash,
- wrong payout hash,
- over-cap amount,
- exhausted budget or escrow,
- duplicate nullifier,
- invalid proof.

The campaign transfers assets and stores the nullifier only after verifier success.

## Validation

Local ZK:

```bash
pnpm zk:build
pnpm zk:prove:demo
pnpm zk:verify:local
pnpm zk:verify:compliance
```

Contracts:

```bash
pnpm contracts:test
pnpm contracts:test:compliance
```

Testnet:

```bash
pnpm stellar:smoke:compliance:testnet
pnpm web:e2e:compliance:testnet
```

The live AIDUSD compliance smokes and browser compliance e2e passed on July 2, 2026 against a fresh active deployment with `complianceRoot` and the current verifier key.

## Disclosure

This is a demo clearance proof over deterministic fixtures. It is suitable for validating the private aid payout architecture, not for production compliance decisions.
