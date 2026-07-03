# Soroban Contract Integration

This document covers the current campaign/verifier contract integration only.

## Campaign Contract

Path:

```txt
contracts/campaign
```

The campaign contract stores:

- `campaign_id`
- `operator`
- `asset`
- `budget`
- `per_recipient_cap`
- `eligibility_root`
- `compliance_root`
- `deny_root`
- `policy_hash`
- `verifier`
- `start_ledger`
- `end_ledger`
- `is_active`

It also stores aggregate stats:

- `total_claimed`
- `claim_count`
- `remaining_budget`
- `duplicate_claims_blocked`
- `invalid_claims_blocked`

## Claim Flow

`claim(public_inputs, proof, payout_recipient)` executes in this order:

1. Load campaign config and stats.
2. Reject if campaign is inactive.
3. Reject if the current ledger is outside the campaign window.
4. Reject if the payout recipient hash does not match `public_inputs.payout_account_hash`.
5. Reject if `public_inputs.campaign_id` does not equal the stored campaign ID.
6. Reject if `public_inputs.eligibility_root` does not equal the stored eligibility root.
7. Reject if `public_inputs.compliance_root` does not equal the stored compliance root.
8. Reject if `public_inputs.policy_hash` does not equal the stored policy hash.
9. Reject if `public_inputs.max_amount` does not equal the stored cap.
10. Reject if `public_inputs.amount` is over `per_recipient_cap`.
11. Reject if remaining budget or escrow balance is insufficient.
12. Reject if `public_inputs.nullifier_hash` is already stored.
13. Call the verifier contract via `verify_claim(public_inputs, proof)`.
14. Reject if the verifier returns `false`.
15. Transfer escrowed asset value to the payout recipient.
16. Store the nullifier.
17. Update `total_claimed`, `claim_count`, and `remaining_budget`.
18. Emit a claim event.

The nullifier is written and the asset is transferred only after verifier success. Failed verifier calls do not mark a nullifier as used and do not increment `total_claimed` or `claim_count`.

## Verifier Interface

Path:

```txt
contracts/verifier
```

Interface:

```rust
verify_claim(public_inputs: ClaimPublicInputs, proof: Bytes) -> bool
```

The campaign contract does not silently trust frontend data. It always calls the verifier interface before accepting a claim.

## Groth16 Verifier

By default, `contracts/verifier` performs real BN254 Groth16 verification for the current `claim_v0` circuit and deterministic development verification key.

The proof byte format is:

```txt
A(G1 64 bytes) || B(G2 128 bytes) || C(G1 64 bytes)
```

The verifier maps `ClaimPublicInputs` into this public signal order:

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

It rejects malformed proof length, out-of-field proof coordinates, invalid G1 points, out-of-field public inputs, negative amounts, failed pairing checks, and proof/public-input mismatches.

## Dev Verifier

The dev verifier is still available only as an explicit feature:

```bash
pnpm contracts:test:dev
```

`dev_verifier` is an explicit feature flag:

```toml
[features]
default = []
dev_verifier = ["lumen_verifier/dev_verifier"]
```

With the feature, the verifier accepts only the deterministic dev proof shape used by explicit dev tests. This is not ZK and must not be deployed as a real verifier. The default `pnpm contracts:test` command does not enable this feature.

## Contract Tests

Run:

```bash
pnpm contracts:test
```

Current campaign tests cover:

- operator initializes campaign,
- config stores root, policy hash, budget, cap, and verifier address,
- valid claim succeeds with the real Alice Groth16 proof,
- duplicate nullifier claim fails,
- wrong eligibility root fails,
- wrong compliance root fails,
- wrong policy hash fails,
- amount over cap fails,
- invalid verifier result fails without storing nullifier,
- swapped/tampered payout recipient fails without transfer,
- claim after close fails.

## Disclosures

- The default verifier uses a deterministic development verification key.
- The dev verifier feature is not production ZK.
- Event publishing still uses the older Soroban event API in places and emits deprecation warnings during tests/builds.
