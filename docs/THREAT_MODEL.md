# Threat Model

## Protected In The Real Local ZK Path

- Public exposure of recipient identity.
- Public exposure of eligibility reason.
- Public exposure of compliance clearance details.
- Unauthorized claims by recipients outside the eligibility Merkle tree.
- Claims by eligible recipients who are not in the compliance clearance Merkle tree.
- Campaign cap violations inside the circuit.
- Claiming against the wrong eligibility root, compliance root, policy hash, or campaign ID.
- Reusing a valid proof for a different Stellar payout recipient.
- Tampered public inputs.
- Tampered Groth16 proofs.
- Duplicate claims at the contract/accounting layer through nullifier reuse.

## Protected In The Browser Testnet Path

- Browser Real Testnet Claim mode generates the Groth16 proof in a Web Worker.
- Browser local verification runs before submission.
- `/api/testnet/claim` accepts only proof bytes, ten public inputs, public payout recipient, campaign contract ID, and campaign ID.
- The relayer rejects private witness field names, mainnet configuration, unknown active campaign IDs, unknown contract IDs, malformed proof encodings, malformed public inputs, stale active deployments without `complianceRoot`, and stale verifier keys.
- The relayer recomputes `payout_account_hash` from the payout recipient and rejects mismatches before transaction submission.
- The campaign recomputes `payout_account_hash` from the Soroban payout recipient `Address` and rejects mismatches before verifier calls or transfers.
- The campaign checks eligibility root, compliance root, policy hash, campaign ID, cap, budget, escrow balance, and duplicate nullifier before payout.
- The campaign/verifier contracts accept or reject claims on Stellar testnet; duplicate nullifiers are rejected by the campaign and do not transfer assets.
- Accepted claims transfer testnet SAC escrow value only after verifier success.
- The donor dashboard reads the active testnet campaign and verifier status, including `verifier_info()` when available.
- The auditor page reads a local demo disclosure package only when supplied by the browser/user; it does not put PII on-chain.

## Real Components

- The eligibility tree is a Poseidon Merkle tree built from deterministic demo recipients.
- The compliance tree is a Poseidon Merkle tree built from deterministic compliance-cleared demo recipients.
- The nullifier is derived as `Poseidon(recipient_secret, campaign_id)`.
- `circuits/claim/claim.circom` constrains eligibility membership, compliance membership, nullifier derivation, amount cap, amount commitment, and payout-bound recipient commitment.
- `pnpm zk:build` runs real Circom compilation and deterministic development Groth16 setup.
- `pnpm zk:prove:demo` generates a real Alice Groth16 proof.
- `pnpm zk:verify:local` and `pnpm zk:verify:compliance` verify with real `snarkjs groth16 verify` and fail if invalid cases pass.
- `contracts/verifier` performs real BN254 Groth16 verification by default for the current `claim_v0` deterministic development verification key.
- `contracts/verifier` exposes `verifier_info()` in new deployments. Default builds report `real_groth16`; dev-feature builds report `dev_verifier`.
- `contracts/campaign` checks payout binding, compliance root, eligibility root, invokes the verifier, transfers escrow value, and writes the nullifier only after verifier success.
- `apps/web/workers/claim-proof.worker.ts` performs browser Groth16 proving and local verification.
- `/api/testnet/claim` relays only public claim payloads to Stellar testnet when explicitly enabled.
- AIDUSD setup/deployment/smoke/browser e2e scripts are implemented, validated on testnet, and write only public metadata.
- Native testnet XLM SAC payout path is preserved as fallback.

## Dev-Only Components

- `packages/prover` emits a deterministic `dev_verifier` envelope only when callers explicitly pass `mode: "dev_verifier"`.
- `contracts/verifier` accepts feature-gated dev bytes only when compiled with `--features dev_verifier`.
- Local Demo mode uses a local Soroban-shaped simulator.
- `pnpm zk:build:dev` may skip Circom compilation and is warning-labeled.
- Demo recipients, eligibility roots, compliance roots, and campaign fixtures are deterministic examples, not production identity, eligibility, or compliance data.

## Not Protected Yet

- Production trusted setup is not implemented.
- Real KYC, sanctions, or compliance provider integration is not implemented.
- Deny-list non-membership is not implemented; the current compliance MVP proves membership in a positive compliance clearance root.
- Direct Freighter transaction signing is not implemented; browser testnet submission uses a local testnet relayer as fee payer.
- Mainnet is not supported.
- Malicious frontend or compromised local prover.
- Compromised operator or dishonest eligibility/compliance set construction.
- IP/browser/RPC/wallet metadata leakage.
- Full private transfer graph analysis.
- Payout addresses are public on Stellar and can be observed on-chain.
- Amounts are public.
- Production-grade auditing.
- Contract event modernization is incomplete; deprecated event publishing warnings remain in the current Soroban SDK build.

## Important Boundary

`Verifier mode: real_local` means snarkjs verified a Groth16 proof on the developer machine or in the browser worker. `Verifier mode: real_groth16` from `verifier_info()` means the deployed Soroban verifier identifies as the default real Groth16 verifier for `claim_v0`.

`dev_verifier` is a development adapter. It demonstrates the contract boundary and rejection flow, but it is not a cryptographic verifier.

`deployments/active-testnet.json` is public deployment metadata, not a source of truth for private witness data. The compliance-aware browser route and e2e refuse pre-compliance active deployments that lack `complianceRoot` or use an old verifier key.

Production deployments must compile without the dev feature, replace the deterministic development setup with a production ceremony, use a current verifier key, deploy fresh compliance-aware campaign metadata, and use a production-grade sponsored relayer or direct signing path.
