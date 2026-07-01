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

## Real Components

- The eligibility tree is a Poseidon Merkle tree built from deterministic demo recipients.
- The nullifier is derived as `Poseidon(recipient_secret, campaign_id)`.
- `circuits/claim/claim.circom` constrains Merkle membership, nullifier derivation, amount cap, amount commitment, and recipient commitment.
- `pnpm zk:build` runs real Circom compilation and deterministic development Groth16 setup.
- `pnpm zk:prove:demo` generates a real Alice Groth16 proof.
- `pnpm zk:verify:local` verifies with real `snarkjs groth16 verify` and fails if invalid cases pass.
- `contracts/verifier` performs real BN254 Groth16 verification by default for the current `claim_v0` development verification key.
- `contracts/campaign` invokes the verifier and writes the nullifier only after the verifier accepts.

## Dev-Only Components

- `packages/prover` emits a deterministic `dev_verifier` envelope only when callers explicitly pass `mode: "dev_verifier"`.
- `contracts/verifier` accepts feature-gated dev bytes only when compiled with `--features dev_verifier`.
- The frontend uses a local Soroban-shaped simulator by default.
- `pnpm zk:build:dev` may skip Circom compilation and is warning-labeled.
- Demo recipients and campaign fixtures are deterministic examples, not production identity or eligibility data.

## Not Protected Yet

- Testnet contract deployment, deterministic campaign initialization, Alice claim acceptance, and Alice duplicate rejection are validated as smoke tests.
- Production trusted setup is not implemented.
- Malicious frontend or compromised local prover.
- Compromised operator or dishonest eligibility set construction.
- IP/browser metadata leakage.
- Full private transfer graph analysis.
- Production-grade auditing.
- Real KYC provider trust assumptions.
- Deny-list non-membership.

## Important Boundary

`Verifier mode: real_local` means snarkjs verified a Groth16 proof on the developer machine. The Soroban verifier contract also verifies Groth16 by default in local contract tests. Current testnet contract IDs are recorded in `deployments/testnet.json`, but a full initialized testnet claim flow is not claimed yet.

`dev_verifier` is a development adapter. It demonstrates the contract boundary and rejection flow, but it is not a cryptographic verifier. Production deployments must compile without the dev feature and replace the deterministic development setup with a production ceremony.
