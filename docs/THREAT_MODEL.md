# Threat Model

## Protected In The Real Local ZK Path

- Public exposure of recipient identity.
- Public exposure of eligibility reason.
- Unauthorized claims by recipients outside the eligibility Merkle tree.
- Campaign cap violations inside the circuit.
- Claiming against the wrong eligibility root or policy hash in local verification.
- Tampered public inputs.
- Tampered Groth16 proofs.
- Duplicate claims at the contract/accounting layer through nullifier reuse.

## Protected In The Browser Testnet Path

- Browser Real Testnet Claim mode generates the Groth16 proof in a Web Worker.
- Browser local verification runs before submission.
- `/api/testnet/claim` accepts only proof bytes, public inputs, campaign contract ID, and campaign ID.
- The relayer rejects private witness field names, mainnet configuration, unknown active campaign IDs, unknown contract IDs, malformed proof encodings, and malformed public inputs.
- The campaign/verifier contracts accept or reject claims on Stellar testnet; duplicate nullifiers are rejected by the campaign.
- The donor dashboard reads the active testnet campaign and verifier status, including `verifier_info()` when available.

## Real Components

- The eligibility tree is a Poseidon Merkle tree built from deterministic demo recipients.
- The nullifier is derived as `Poseidon(recipient_secret, campaign_id)`.
- `circuits/claim/claim.circom` constrains Merkle membership, nullifier derivation, amount cap, amount commitment, and recipient commitment.
- `pnpm zk:build` runs real Circom compilation and deterministic development Groth16 setup.
- `pnpm zk:prove:demo` generates a real Alice Groth16 proof.
- `pnpm zk:verify:local` verifies with real `snarkjs groth16 verify` and fails if invalid cases pass.
- `contracts/verifier` performs real BN254 Groth16 verification by default for the current `claim_v0` development verification key.
- `contracts/verifier` exposes `verifier_info()` in new deployments. Default builds report `real_groth16`; dev-feature builds report `dev_verifier`.
- `contracts/campaign` invokes the verifier and writes the nullifier only after the verifier accepts.
- `apps/web/workers/claim-proof.worker.ts` performs browser Groth16 proving and local verification.
- `/api/testnet/claim` relays only public claim payloads to Stellar testnet when explicitly enabled.

## Dev-Only Components

- `packages/prover` emits a deterministic `dev_verifier` envelope only when callers explicitly pass `mode: "dev_verifier"`.
- `contracts/verifier` accepts feature-gated dev bytes only when compiled with `--features dev_verifier`.
- Local Demo mode uses a local Soroban-shaped simulator.
- `pnpm zk:build:dev` may skip Circom compilation and is warning-labeled.
- Demo recipients and campaign fixtures are deterministic examples, not production identity or eligibility data.

## Not Protected Yet

- Production trusted setup is not implemented.
- Freighter wallet mode is not implemented; browser testnet submission uses a local testnet relayer.
- Mainnet is not supported.
- Malicious frontend or compromised local prover.
- Compromised operator or dishonest eligibility set construction.
- IP/browser metadata leakage.
- Full private transfer graph analysis.
- Production-grade auditing.
- Real KYC provider trust assumptions.
- Deny-list non-membership.

## Important Boundary

`Verifier mode: real_local` means snarkjs verified a Groth16 proof on the developer machine or in the browser worker. `Verifier mode: real_groth16` from `verifier_info()` means the deployed Soroban verifier identifies as the default real Groth16 verifier for `claim_v0`. Active product testnet IDs are recorded in `deployments/active-testnet.json`.

`dev_verifier` is a development adapter. It demonstrates the contract boundary and rejection flow, but it is not a cryptographic verifier. Production deployments must compile without the dev feature and replace the deterministic development setup with a production ceremony.
