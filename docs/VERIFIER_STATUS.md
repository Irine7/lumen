# Verifier Status

This file is the canonical truth source for how Lumen should describe proof generation, verification, and testnet claim status.

## Allowed Status Labels

Use only these labels in the frontend and technical docs:

- **Real local ZK proof**
- **Real on-chain verification**
- **Dev-only on-chain verifier**

## Current Truth Table

| Layer | Status | Command / code path | Notes |
| --- | --- | --- | --- |
| Circuit source | Real | `circuits/claim/claim.circom` | Circom claim circuit with eligibility membership, compliance clearance membership, nullifier, cap, amount commitment, and payout-bound recipient commitment constraints. |
| Circuit compilation | Real | `pnpm zk:build` | Builds the compliance circuit with 10 public inputs and deterministic development Groth16 artifacts. |
| Witness generation | Real | `pnpm zk:prove:demo` | Uses `claim_js/generate_witness.js` from Circom output. |
| Proof generation | Real local ZK proof | `pnpm zk:prove:demo` | Uses `snarkjs groth16 prove` and writes Alice proof artifacts. |
| Local proof verification | Real local ZK proof | `pnpm zk:verify:local` | Uses `snarkjs groth16 verify` and `verification_key.json`. |
| Compliance negative verification | Real local ZK proof | `pnpm zk:verify:compliance` | Alice passes; Eve, Mallory, tampered compliance root/path, wrong policy, over-cap, and proof/public-input tampering fail. |
| Soroban verifier contract default | Real on-chain verification for current development key | `contracts/verifier`, `pnpm contracts:test` | Uses Soroban BN254 pairing checks against the embedded `claim_v0` deterministic development verification key. |
| Verifier self-identification | Real on-chain introspection | `verifier_info()` | Default build reports `mode = real_groth16`, `version = claim_v0`; dev-feature build reports `mode = dev_verifier`. |
| Soroban campaign contract integration | Real on-chain verification in tests | `contracts/campaign`, `pnpm contracts:test` | Campaign checks roots, payout binding, cap, duplicate nullifier, and verifier result before storing nullifier or transferring assets. |
| Soroban dev verifier feature | Dev-only on-chain verifier | `contracts/verifier --features dev_verifier`, `pnpm contracts:test:dev` | Explicit feature path that accepts deterministic test bytes. Not ZK. |
| TypeScript local demo proof envelope | Dev-only on-chain verifier | `packages/prover`, Local Demo mode | Requires explicit `mode: "dev_verifier"`. Not Groth16. |
| Browser proof generation | Real local ZK proof | `apps/web/workers/claim-proof.worker.ts` | Uses browser snarkjs Groth16 proving with public artifacts from `pnpm web:zk:prepare`. |
| Browser local verification | Real local ZK proof | `apps/web/workers/claim-proof.worker.ts` | Uses browser snarkjs Groth16 verification before submission. |
| Browser testnet claim submission | Real on-chain verification when active deployment is compliance-current | `/api/testnet/claim` | Browser sends proof encoding, ten public inputs, and public payout recipient to a testnet-only local relayer. The route now rejects pre-compliance active deployments. |
| Native XLM SAC payout path | Real testnet fallback | `pnpm stellar:fresh-payout-campaign:testnet`, `pnpm stellar:smoke:payout:testnet` | Preserved as fallback. |
| AIDUSD SAC payout path | Real testnet validated | `pnpm stellar:asset:setup-aidusd:testnet`, `pnpm stellar:fresh-aidusd-campaign:testnet`, `pnpm stellar:smoke:aidusd:testnet`, `pnpm web:e2e:compliance:testnet` | Preferred stablecoin-style path. Live testnet setup, fresh compliance deployment, CLI smoke, and browser e2e passed on July 2, 2026. |
| Auditor selective disclosure | Product-layer demo | `apps/web/app/auditor` | Loads local demo audit package; does not put PII on-chain and does not imply real KYC provider integration. |
| Dev artifact build | Dev-only on-chain verifier | `pnpm zk:build:dev` | May skip Circom; must warn that it is not cryptographic verification. |
| Production trusted setup | Not implemented | Future work | Current `ptau`/`zkey` are deterministic development artifacts. |
| Audit | Not completed | Future work | Circuit, setup, prover, contracts, relayer, and frontend need external review before production. |

## Real Local ZK Proof

The real local proof path is:

```txt
claim.circom
  -> Circom R1CS/WASM/SYM
  -> deterministic development Groth16 setup
  -> Alice witness
  -> snarkjs Groth16 proof
  -> snarkjs local verification
```

The compliance circuit constrains:

```txt
eligibility_leaf = Poseidon(recipient_secret, identity_hash, leaf_salt, policy_hash)
computed_eligibility_root == eligibility_root
compliance_leaf = Poseidon(recipient_secret, identity_hash, compliance_leaf_salt, policy_hash)
computed_compliance_root == compliance_root
nullifier_hash = Poseidon(recipient_secret, campaign_id)
amount <= max_amount
amount_commitment = Poseidon(amount, amount_salt, campaign_id)
recipient_commitment = Poseidon(recipient_secret, policy_hash, payout_account_hash)
```

`policy_hash` currently folds the demo compliance provider/policy scope. There is no separate production KYC/sanctions provider integration.

## Real On-Chain Verification

`contracts/verifier` performs BN254 Groth16 verification by default for the current `claim_v0` circuit and embedded deterministic development verification key.

Proof byte format:

```txt
A(G1 64 bytes) || B(G2 128 bytes) || C(G1 64 bytes)
```

Public signal order:

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

Current deterministic development verification key hash:

```txt
0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92
```

`pnpm contracts:test` verifies that:

- the valid Alice Groth16 proof passes,
- invalid proof data fails,
- tampered public input fails,
- tampered proof data fails,
- malformed proof data fails,
- wrong compliance root fails,
- the campaign contract rejects a claim when the verifier rejects the proof,
- no nullifier is stored and no asset is transferred before proof verification succeeds.

Important qualifications:

- The verification key is a deterministic development verification key.
- Production trusted setup is not complete.
- Browser-submitted testnet payout claims use a local testnet relayer. Freighter address binding is implemented; direct Freighter transaction signing is not implemented.

## Dev-Only Verifier Boundary

`dev_verifier` is not cryptographic proof verification. It exists only for:

- local frontend/demo flow,
- local Soroban-shaped simulator behavior,
- explicit Rust contract tests run with `pnpm contracts:test:dev`,
- explicit `pnpm zk:build:dev` artifacts.

Any command or UI path that uses dev verifier behavior must make clear:

```txt
Dev-only on-chain verifier
```

and must not imply production ZK.

The real local/browser commands do not silently fall back to dev behavior.

## Testnet Status

Current public active testnet IDs are written to:

```txt
deployments/active-testnet.json
```

Compliance-aware browser e2e rejects active metadata that lacks `complianceRoot` or the current verifier key. The current active testnet deployment is AIDUSD/SAC, includes `complianceRoot`, and uses the current `claim_v0` verifier key hash.

Smoke-test commands:

```bash
pnpm stellar:fresh-payout-campaign:testnet
pnpm stellar:payout:active:testnet
pnpm stellar:smoke:payout:testnet
pnpm web:e2e:payout:testnet
pnpm stellar:asset:doctor:testnet
pnpm stellar:asset:setup-aidusd:testnet
pnpm stellar:fresh-aidusd-campaign:testnet
pnpm stellar:aidusd:active:testnet
pnpm stellar:smoke:aidusd:testnet
pnpm stellar:smoke:compliance:testnet
pnpm web:e2e:compliance:testnet
```

Accurate status wording:

```txt
Local cryptographic proof verification: real.
Browser cryptographic proof generation: real Groth16.
Browser local proof verification: real Groth16.
Eligibility proof: real Merkle membership proof.
Compliance clearance proof: real Merkle membership proof over demo clearance root.
On-chain cryptographic proof verification: real for local contract tests and fresh testnet deployments using the current verifier key.
Payout binding: real proof-bound payout_account_hash checked by relayer and campaign.
AIDUSD payout: live testnet setup/deployment/smoke/browser e2e validated.
Native XLM SAC payout: preserved fallback path.
Browser testnet submission: implemented through testnet-only local relayer when active deployment is current.
Local Demo verifier: dev-only simulator envelope.
```

## Remaining Production Work

- Replace deterministic development setup with a production ceremony.
- Generate and manage production verification keys.
- Integrate a real compliance/KYC/sanctions provider and policy attestation process.
- Add direct Freighter signing mode or a production-grade sponsored relayer.
- Audit the circuit, setup, prover, contracts, relayer, and frontend.
