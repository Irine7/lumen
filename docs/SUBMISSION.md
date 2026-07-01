# DoraHacks Submission Content

## Project title

Lumen

## One-liner

Private, ZK-compliant aid disbursements on Stellar.

## Short description

Lumen helps humanitarian aid campaigns distribute Stellar-based assistance without exposing recipient identity trails. Recipients prove eligibility with zero-knowledge membership proofs, while Soroban campaign contracts track aggregate budgets, nullifiers, successful claims, duplicate blocks, and invalid claim attempts for donor accountability.

## Full description

Public blockchains are useful for accountable aid distribution, but they can expose vulnerable recipients. A public payment trail may reveal who received disaster relief, medical assistance, household grants, or other sensitive support.

Lumen is a privacy-preserving aid disbursement prototype built on Stellar and Soroban. Campaign operators publish an eligibility Merkle root and policy hash instead of a recipient list. A recipient generates a claim proof from private identity-derived data, a secret, salts, and a Merkle path. The public claim contains only commitments, a campaign-specific nullifier, the claim amount, and proof bytes.

The Soroban campaign contract enforces campaign rules, rejects duplicate nullifiers, and updates aggregate donor-facing stats. Donors can see total budget, distributed amount, remaining amount, successful claims, duplicate claims blocked, invalid claims blocked, privacy status, and verifier status without seeing recipient identities or eligibility reasons.

The hackathon demo shows Alice as an eligible recipient, Alice's duplicate claim being blocked, and Mallory being rejected because she is not in the eligibility tree. It also includes a donor dashboard and a technical debug page for synthetic fixture inspection.

## Technical description

Lumen has four core technical layers:

- **Soroban campaign contract**: stores campaign config, budget, per-recipient cap, eligibility root, policy hash, verifier address, nullifiers, and aggregate stats. It validates root, policy hash, amount cap, remaining budget, duplicate nullifier status, and verifier result before accepting a claim.
- **Eligibility Merkle tree**: the operator commits to eligible recipients with a public Merkle root. The private recipient witness contains the secret, identity hash, salts, Merkle path, and path indices.
- **Nullifier-based double-claim prevention**: each claim derives `nullifier_hash = Poseidon(recipient_secret, campaign_id)`. The campaign stores used nullifiers only after verifier success, preventing repeat claims without revealing identity.
- **ZK proof generation and verification**: the `claim.circom` circuit proves Merkle membership, nullifier derivation, amount cap compliance, amount commitment, and recipient commitment. The real local path uses Circom and snarkjs Groth16. The Soroban verifier contract performs BN254 Groth16 verification by default for the current development verification key.

Verifier status is intentionally explicit:

- Real local ZK proof: Circom/snarkjs Groth16 proof generation and local verification.
- Real on-chain verification: Soroban Groth16 verifier in contract tests and deployed testnet smoke path.
- Dev-only on-chain verifier: browser/local simulator envelope and explicit dev feature path. This is not production ZK.

The donor aggregate dashboard reads campaign stats and recent events, showing accountability without exposing a public recipient list.

## What is working

- Next.js demo app with landing, operator, recipient, donor, and debug pages.
- Premium dark demo UI focused on judge clarity.
- Deterministic demo campaign fixtures.
- Eligibility Merkle tree generation.
- Poseidon leaf, nullifier, amount commitment, and recipient commitment helpers.
- Recipient flow for Alice accepted once.
- Duplicate nullifier rejection for Alice's second claim.
- Mallory invalid-recipient rejection.
- Donor dashboard with aggregate accountability metrics.
- Technical debug page with synthetic private witness inspection warning.
- Circom claim circuit.
- Real local Groth16 proof generation with snarkjs.
- Real local Groth16 verification with snarkjs.
- Negative local verifier cases for Mallory, over-cap amount, tampered public input, tampered proof, wrong campaign ID, and wrong policy hash.
- Soroban campaign contract tests.
- Soroban Groth16 verifier contract by default.
- Stellar testnet deployment metadata.
- Testnet Alice claim smoke test.
- Testnet duplicate nullifier smoke test.

## What is real ZK

- `circuits/claim/claim.circom` models the claim constraints.
- `pnpm zk:build` compiles the circuit and builds deterministic development Groth16 artifacts.
- `pnpm zk:prove:demo` generates Alice's witness and Groth16 proof with snarkjs.
- `pnpm zk:verify:local` verifies Alice and rejects invalid/tampered cases.
- `contracts/verifier` performs BN254 Groth16 verification by default for the current `claim_v0` development verification key.
- `pnpm contracts:test` verifies valid Alice proof acceptance and invalid/tampered proof rejection through contract tests.
- `pnpm stellar:claim:alice:testnet` runs the deployed testnet verifier smoke path before/with claim submission.

## What is demo-only

- The browser recipient flow uses a local Soroban-shaped simulator.
- The browser proof payload uses an explicit `dev_verifier` envelope, not a production Groth16 browser prover.
- `pnpm zk:build:dev` is an explicit dev-only artifact path and may skip Circom.
- `contracts/verifier --features dev_verifier` accepts deterministic test-only bytes; default builds do not enable this.
- Demo recipients and campaign data are deterministic fixtures.
- Private witness values are visible only on the debug page or when the UI demo reveal toggle is used.
- Browser-submitted testnet claims are not wired yet.
- Trusted setup is deterministic development setup, not a production ceremony.

## Built with

- Stellar testnet.
- Soroban smart contracts.
- Rust 2021.
- `soroban-sdk 27.0.0-rc.1`.
- Circom claim circuit, `pragma circom 2.1.6`.
- Project-local Circom compiler install from tag `v2.2.3`.
- `snarkjs 0.7.6`.
- `circomlib 2.0.5`.
- TypeScript `5.8.3`.
- Next.js `16.2.9`.
- React `19.2.7`.
- Tailwind CSS `4.3.2`.
- `poseidon-lite 0.3.0`.
- Vitest.
- pnpm `11.7.0`.

## Repository structure

```txt
apps/web              Next.js demo UI
contracts/campaign    Soroban campaign contract
contracts/verifier    Soroban Groth16 verifier and explicit dev feature
contracts/mock_token  Demo token helper
circuits/claim        Circom claim circuit and proof scripts
packages/shared       Types and deterministic demo fixtures
packages/merkle       Poseidon Merkle/nullifier/commitment helpers
packages/prover       Dev envelope adapter and local witness checks
packages/stellar      Local/testnet campaign client helpers
scripts               ZK, E2E, and Stellar scripts
docs                  Submission docs and technical notes
deployments           Public testnet deployment evidence
```

## How to run

```bash
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Reproduce the ZK proof path:

```bash
pnpm zk:doctor
pnpm zk:setup
pnpm zk:clean
pnpm zk:build
pnpm zk:prove:demo
pnpm zk:verify:local
```

Run the deterministic CLI demo:

```bash
pnpm demo:e2e
```

Run tests and builds:

```bash
pnpm test
pnpm contracts:test
pnpm build
```

Run testnet smoke commands with a funded Stellar CLI source account:

```bash
pnpm stellar:doctor
pnpm contracts:build
pnpm stellar:deploy:testnet
pnpm stellar:init-campaign:testnet
pnpm stellar:claim:alice:testnet
pnpm stellar:claim:alice-duplicate:testnet
```

Current public testnet IDs:

```txt
verifier   = CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D
campaign   = CCICXWSMCEY47JF2OWQ3OQMZEHVC5URNCWELWHQ2YRJEI2ETWKUAXCWI
mock token = CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7
```

## Demo video script

**0:00-0:20 - Problem**

Public blockchains are transparent, but humanitarian recipients need privacy. Lumen keeps recipient eligibility private while preserving donor accountability.

**0:20-0:45 - Architecture**

Show the landing page diagram: Operator -> Eligibility root -> Recipient ZK proof -> Soroban campaign contract -> Donor dashboard. Explain that the chain sees commitments, nullifiers, proof bytes, and aggregate stats, not a recipient list.

**0:45-1:25 - Recipient claim**

Open the recipient page. Select Alice, generate the proof, show local verification status, and submit the claim. Alice is accepted once. Point out the private panel is hidden by default and the public panel contains campaign ID, root, policy hash, nullifier hash, amount, and proof.

**1:25-1:45 - Abuse prevention**

Click Try duplicate for Alice. The same nullifier is blocked. Select Mallory and generate/submit the claim. Mallory is rejected because she is not in the eligibility tree.

**1:45-2:15 - Donor accountability**

Open the donor dashboard. Show total budget, distributed amount, remaining amount, successful claims, duplicate claims blocked, invalid claims blocked, privacy status, and verifier status.

**2:15-2:45 - Technical honesty**

Open the debug page and show the warning: "Demo debug mode. Do not use with real recipient data." State the verifier boundary: real local Groth16 proof and deployed testnet verifier smoke path are working; browser-submitted testnet claims are not wired yet and the browser demo uses the dev-only verifier envelope.

## Future roadmap

- Replace deterministic development Groth16 setup with a production trusted setup ceremony.
- Generate and manage production verification keys.
- Move proving into a browser worker with artifact caching.
- Wire browser-submitted testnet claims through wallet/RPC integration.
- Add confidential amount support.
- Add auditor view keys and donor reporting exports.
- Integrate NGO/KYC provider workflows.
- Add deny-list non-membership proofs.
- Add Freighter/mobile wallet support.
- Complete external cryptography and smart contract audits.
