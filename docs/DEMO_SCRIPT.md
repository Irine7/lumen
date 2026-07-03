# Historical Draft: Demo Script

This is an older walkthrough draft and is not the current video script. Do not use it for final submission copy; use `README.md`, `docs/VERIFIER_STATUS.md`, and `reports/latest/` for current validated product state.

## Pre-demo setup

Install dependencies and start the app:

```bash
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Optional deterministic CLI proof/demo check:

```bash
pnpm demo:e2e
```

Optional real local ZK proof check:

```bash
pnpm zk:doctor
pnpm zk:setup
pnpm zk:clean
pnpm zk:build
pnpm zk:prove:demo
pnpm zk:verify:local
```

## 2-3 minute video script

### 0:00-0:20 - Problem

"Lumen is private, ZK-compliant aid disbursements on Stellar. Public blockchains are transparent, but humanitarian aid recipients should not have their payment trails, identity, or eligibility reasons exposed. Donors still need aggregate accountability."

Show the landing page bullets:

- Public blockchains expose payment trails.
- Humanitarian aid recipients need privacy.
- Lumen lets recipients prove eligibility in zero knowledge.
- Donors still get aggregate accountability.
- Built on Stellar/Soroban.

### 0:20-0:40 - Architecture

Show the architecture diagram:

```txt
Operator -> Eligibility root -> Recipient ZK proof -> Soroban campaign contract -> Donor dashboard
```

Say:

"The operator commits an eligibility root and policy hash. The recipient proves membership without revealing the private witness. The Soroban campaign contract checks claim rules and nullifiers. The donor dashboard reads aggregate state, not a recipient list."

### 0:40-1:20 - Recipient accepted flow

Go to `/recipient`.

1. Select **Alice**.
2. Click **Generate proof**.
3. Point to **Local verification status**.
4. Show the two panels:
   - **Private, not submitted publicly**: recipient secret, identity data, Merkle path, witness.
   - **Public, sent to contract**: campaign ID, eligibility root, policy hash, nullifier hash, amount, proof.
5. Keep private values hidden by default, then use **Demo reveal private values** only to show these are synthetic fixtures.
6. Click **Submit claim**.
7. Show accepted result.

Say:

"Alice is in the eligibility tree. Her private witness stays local in the real proof model. The public payload contains only campaign commitments, a nullifier, amount, and proof."

### 1:20-1:45 - Duplicate protection

Click **Try duplicate** for Alice.

Say:

"The duplicate claim is blocked by the same campaign-specific nullifier. The contract should not need Alice's identity to prevent double claiming."

Show the duplicate blocked status.

### 1:45-2:05 - Invalid recipient

Select **Mallory**.

Click **Generate proof** and **Submit claim**.

Say:

"Mallory is not in the eligibility tree. The local witness check fails, the demo verifier rejects, and the claim is counted as invalid."

Show the rejected status.

### 2:05-2:30 - Donor accountability

Go to `/donor`.

Show:

- total budget,
- distributed amount,
- remaining amount,
- successful claims,
- duplicate claims blocked,
- invalid claims blocked,
- privacy status,
- verifier status.

Say:

"Donors get campaign-level accountability without a public recipient list."

### 2:30-2:50 - Debug and honesty boundary

Go to `/debug`.

Point to the warning:

```txt
Demo debug mode. Do not use with real recipient data.
```

Say:

"This technical route exposes synthetic fixture data only. The project is explicit about verifier status: real local Groth16 proof generation and verification are working, the Soroban verifier is real for the deployed testnet smoke path, and the browser demo itself uses a dev-only verifier envelope until browser testnet submission is wired."

## Judge talking points

### What is working

- Frontend demo flow for operator, recipient, donor, and debug views.
- Alice accepted once.
- Alice duplicate blocked by nullifier.
- Mallory rejected.
- Donor aggregate dashboard.
- Circom claim circuit.
- Real local Groth16 proof generation and verification.
- Soroban campaign contract tests.
- Soroban Groth16 verifier contract by default.
- Stellar testnet deployment metadata.
- Testnet Alice claim and duplicate smoke tests.

### What is real ZK

- `pnpm zk:build` compiles the Circom circuit.
- `pnpm zk:prove:demo` generates a real Groth16 proof with snarkjs.
- `pnpm zk:verify:local` verifies the proof and rejects invalid/tampered cases.
- `pnpm contracts:test` covers Groth16 verifier behavior in contracts.
- `pnpm stellar:claim:alice:testnet` exercises the deployed testnet verifier smoke path.

### What is demo-only

- The browser flow uses a local Soroban-shaped simulator.
- The browser proof payload is an explicit `dev_verifier` envelope.
- Browser-submitted testnet claims are not wired yet.
- Demo data is deterministic synthetic fixture data.
- The trusted setup is deterministic development setup, not production ceremony output.

## CLI demo output

Run:

```bash
pnpm demo:e2e
```

Expected shape:

```txt
Lumen - ZK Private Aid Disbursement Demo

1. Campaign setup
Circuit compiled
Campaign ID: 0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101
Eligibility root: 0x1533dddeb2e62943d31b07f72e99112fca3a7f0b21c5804ea27113c8e60d737a
Policy hash: 0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21
Per-recipient cap: 250
Budget: 1000

2. Alice valid recipient
Private witness prepared locally
Proof generated
Local cryptographic verification passed
Nullifier derived: 0x304839a43cd2b03a7c030591abb845e56e4fa662d30f2540656df7b825887c66
Claim accepted
Campaign stats updated: totalClaimed=125, claimCount=1, remainingBudget=875

3. Alice duplicate attempt
Same nullifier detected
Alice duplicate claim rejected

4. Mallory invalid recipient
Mallory not in eligibility tree
Proof rejected by local witness checks
Mallory rejected

5. Final summary
Successful claims: 1
Duplicate claims blocked: 1
Invalid claims blocked: 4
Public recipient identity leaked: no
Local cryptographic proof verification: real
On-chain proof verification: real in deployed testnet verifier
Local browser/demo campaign path remains a simulator until frontend testnet submission is wired.
```

## Testnet smoke

With a funded local Stellar CLI source account:

```bash
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
