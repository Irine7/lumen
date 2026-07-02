# Verifier Status

This file is the canonical truth source for how Lumen should describe verification. The UI and submission materials must not claim anything stronger than this document.

## Allowed status labels

Use only these labels in the frontend and demo:

- **Real local ZK proof**
- **Real on-chain verification**
- **Dev-only on-chain verifier**

## Current truth table

| Layer | Status | Command / code path | Notes |
| --- | --- | --- | --- |
| Circuit source | Real | `circuits/claim/claim.circom` | Circom claim circuit with Merkle membership, nullifier, cap, amount commitment, and recipient commitment constraints. |
| Circuit compilation | Real | `pnpm zk:build` | Requires Circom. Fails if the compiler is missing. |
| Witness generation | Real | `pnpm zk:prove:demo` | Uses `claim_js/generate_witness.js` from Circom output. |
| Proof generation | Real local ZK proof | `pnpm zk:prove:demo` | Uses `snarkjs groth16 prove` and writes Alice proof artifacts. |
| Local proof verification | Real local ZK proof | `pnpm zk:prove:demo`, `pnpm zk:verify:local` | Uses `snarkjs groth16 verify` and `verification_key.json`. |
| Negative local verification | Real local ZK proof | `pnpm zk:verify:local` | Alice passes; Mallory, over-cap, tampered public input, tampered proof, wrong campaign ID, and wrong policy hash fail. |
| Soroban verifier contract default | Real on-chain verification for current development key | `contracts/verifier`, `pnpm contracts:test` | Uses Soroban BN254 pairing checks against the embedded `claim_v0` development verification key. |
| Verifier self-identification | Real on-chain introspection | `verifier_info()` | Default build reports `mode = real_groth16`, `version = claim_v0`; dev-feature build reports `mode = dev_verifier`. Legacy deployed verifiers are labeled "Verifier mode: legacy verifier, mode not introspectable". |
| Soroban campaign contract integration | Real on-chain verification in tests | `contracts/campaign`, `pnpm contracts:test` | Campaign calls verifier before storing nullifier or updating claim stats. |
| Soroban dev verifier feature | Dev-only on-chain verifier | `contracts/verifier --features dev_verifier`, `pnpm contracts:test:dev` | Explicit feature path that accepts deterministic test bytes. Not ZK. Root `pnpm contracts:test` does not enable it. |
| TypeScript local demo proof envelope | Dev-only on-chain verifier | `packages/prover`, Local Demo mode | Requires explicit `mode: "dev_verifier"`. Not Groth16. |
| Browser proof generation | Real local ZK proof | `apps/web/workers/claim-proof.worker.ts`, `pnpm web:e2e:testnet` | Uses browser snarkjs Groth16 proving with public artifacts from `pnpm web:zk:prepare`. |
| Browser local verification | Real local ZK proof | `apps/web/workers/claim-proof.worker.ts`, `pnpm web:e2e:testnet` | Uses browser snarkjs Groth16 verification before submission. |
| Browser testnet submission | Real on-chain verification smoke path | `/api/testnet/claim`, `pnpm web:e2e:testnet` | Browser sends only proof encoding and public inputs to a testnet-only local relayer; Soroban campaign/verifier accepts or rejects. |
| Dev artifact build | Dev-only on-chain verifier | `pnpm zk:build:dev` | May skip Circom; must warn that it is not cryptographic verification. |
| Testnet deployment | Real on-chain verification deployed | `pnpm stellar:deploy:testnet`, `pnpm stellar:init-campaign:testnet` | Verifier, campaign, mock token, and deterministic campaign metadata are recorded in `deployments/`. |
| Testnet Alice claim smoke | Real on-chain verification smoke path | `pnpm stellar:claim:alice:testnet` | Alice claim accepted on deployed campaign after local proof generation/verification and deployed verifier smoke path. |
| Testnet duplicate smoke | Real on-chain verification smoke path | `pnpm stellar:claim:alice-duplicate:testnet` | Duplicate rejected with `DuplicateNullifier #10`. |
| Fresh active testnet campaign | Real on-chain verification smoke path | `pnpm stellar:fresh-campaign:testnet`, `pnpm stellar:active:testnet` | Creates a fresh campaign for browser/smoke validation and records only public data in `deployments/active-testnet.json`. |
| Production trusted setup | Not implemented | Future work | Current `ptau`/`zkey` are deterministic development artifacts. |
| Audit | Not completed | Future work | Circuit, setup, prover, and contracts need external review before production. |

## Real local ZK proof

The real local proof path is:

```txt
claim.circom
  -> Circom R1CS/WASM/SYM
  -> deterministic development Groth16 setup
  -> Alice witness
  -> snarkjs Groth16 proof
  -> snarkjs local verification
```

Expected `pnpm zk:prove:demo` output includes:

```txt
Proof system: Groth16
Circuit: circuits/claim/claim.circom
Proof generated: true
Local verification: true
Verifier mode: real_local
```

This can be described as **Real local ZK proof**.

## Real on-chain verification

`contracts/verifier` performs BN254 Groth16 verification by default for the current `claim_v0` circuit and embedded deterministic development verification key.

Proof byte format:

```txt
A(G1 64 bytes) || B(G2 128 bytes) || C(G1 64 bytes)
```

Public signal order:

```txt
campaign_id
eligibility_root
policy_hash
nullifier_hash
amount
max_amount
amount_commitment
recipient_commitment
```

`pnpm contracts:test` verifies that:

- the valid Alice Groth16 proof passes,
- invalid proof data fails,
- tampered public input fails,
- tampered proof data fails,
- malformed proof data fails,
- the campaign contract rejects a claim when the verifier rejects the proof.

This can be described as **Real on-chain verification** for local contract tests and the deployed testnet smoke path.

Important qualification:

- The verification key is a deterministic development verification key.
- Production trusted setup is not complete.
- Browser-submitted testnet claims are implemented through the local testnet relayer, not Freighter.

## Dev-only verifier boundary

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

## Testnet status

Current public active testnet IDs are written to:

```txt
deployments/active-testnet.json
```

Smoke-test commands:

```bash
pnpm stellar:fresh-campaign:testnet
pnpm stellar:active:testnet
pnpm stellar:smoke:testnet:full
pnpm web:e2e:testnet
```

Accurate status wording:

```txt
Local cryptographic proof verification: real.
Browser cryptographic proof generation: real Groth16.
Browser local proof verification: real Groth16.
On-chain cryptographic proof verification: real for the active deployed testnet verifier path.
Browser testnet submission: implemented through testnet-only local relayer.
Local Demo verifier: dev-only simulator envelope.
```

## Remaining production work

- Replace deterministic development setup with a production ceremony.
- Generate and manage production verification keys.
- Add Freighter wallet mode or a production-grade relayer.
- Audit the circuit, setup, prover, and contracts.
