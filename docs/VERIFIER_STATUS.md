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
| Soroban campaign contract integration | Real on-chain verification in tests | `contracts/campaign`, `pnpm contracts:test` | Campaign calls verifier before storing nullifier or updating claim stats. |
| Soroban dev verifier feature | Dev-only on-chain verifier | `contracts/verifier --features dev_verifier`, `pnpm contracts:test:dev` | Explicit feature path that accepts deterministic test bytes. Not ZK. Root `pnpm contracts:test` does not enable it. |
| TypeScript browser proof envelope | Dev-only on-chain verifier | `packages/prover`, browser demo | Requires explicit `mode: "dev_verifier"`. Not Groth16. |
| Dev artifact build | Dev-only on-chain verifier | `pnpm zk:build:dev` | May skip Circom; must warn that it is not cryptographic verification. |
| Testnet deployment | Real on-chain verification deployed | `pnpm stellar:deploy:testnet`, `pnpm stellar:init-campaign:testnet` | Verifier, campaign, mock token, and deterministic campaign metadata are recorded in `deployments/`. |
| Testnet Alice claim smoke | Real on-chain verification smoke path | `pnpm stellar:claim:alice:testnet` | Alice claim accepted on deployed campaign after local proof generation/verification and deployed verifier smoke path. |
| Testnet duplicate smoke | Real on-chain verification smoke path | `pnpm stellar:claim:alice-duplicate:testnet` | Duplicate rejected with `DuplicateNullifier #10`. |
| Frontend/browser testnet submission | Not wired | Future work | The browser demo currently uses a local simulator/dev envelope. |
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
- The browser app does not yet submit claims directly to testnet.

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

The real local commands do not silently fall back to dev behavior.

## Testnet status

Current public testnet IDs:

```txt
verifier   = CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D
campaign   = CCICXWSMCEY47JF2OWQ3OQMZEHVC5URNCWELWHQ2YRJEI2ETWKUAXCWI
mock token = CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7
```

Smoke-test commands:

```bash
pnpm stellar:init-campaign:testnet
pnpm stellar:claim:alice:testnet
pnpm stellar:claim:alice-duplicate:testnet
```

Accurate status wording:

```txt
Local cryptographic proof verification: real.
On-chain cryptographic proof verification: real for the deployed testnet verifier smoke path.
Frontend/browser testnet submission: not yet wired.
Browser demo verifier: dev-only simulator envelope.
```

## Remaining production work

- Replace deterministic development setup with a production ceremony.
- Generate and manage production verification keys.
- Wire browser claim submission to deployed testnet contracts.
- Audit the circuit, setup, prover, and contracts.
