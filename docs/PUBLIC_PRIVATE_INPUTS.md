# Public And Private Inputs

This document describes the compliance-aware `claim_v0` inputs used by the CLI, browser worker, relayer, Soroban verifier, and campaign contract.

Run:

```bash
pnpm zk:doctor
pnpm zk:setup
pnpm zk:clean
pnpm zk:build
pnpm zk:prove:demo
pnpm zk:verify:local
pnpm zk:verify:compliance
```

`zk:prove:demo` generates Alice's witness and real Groth16 proof with snarkjs. `zk:verify:local` and `zk:verify:compliance` verify Alice and prove that invalid eligibility, invalid compliance, tampered roots/paths, over-cap, and proof/public-input tampering fail.

## Deterministic Demo Context

| Value | Source | Artifact |
| --- | --- | --- |
| Eligible recipients | `packages/shared/src/demo/recipients.ts` | `eligibility-tree.json` |
| Compliance-cleared recipients | `packages/shared/src/demo/recipients.ts` | `compliance-tree.json` |
| Campaign config | `createDemoCampaignConfig()` | `demo-campaign.json` |
| Campaign ID | `DEMO_CAMPAIGN_ID` | `alice-public-inputs.json` |
| Policy hash | `DEMO_POLICY_HASH` | `alice-public-inputs.json` |
| Eligibility root | Poseidon Merkle root over Alice, Bob, Charlie, Dora, and Eve leaves | `eligibility-tree.json` |
| Compliance root | Poseidon Merkle root over Alice, Bob, Charlie, and Dora leaves | `compliance-tree.json` |
| Demo payout address | `DEMO_PAYOUT_ADDRESS` | public fixture only |

Current deterministic values after the compliance circuit build:

```txt
campaign_id      = 0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101
eligibility_root = 0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e
compliance_root  = 0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e
policy_hash      = 0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21
alice_nullifier  = 0x304839a43cd2b03a7c030591abb845e56e4fa662d30f2540656df7b825887c66
```

## Private Inputs

The fixed-depth demo circuit has 17 expanded private witness fields:

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

The table below groups those expanded fields by product concept.

These values are never submitted to any API route or contract. CLI scripts may write them only to ignored local/debug artifacts or temporary directories so the proof path is reproducible. Browser Real Testnet Claim mode keeps them inside the browser worker.

| Input | Type | Derivation / meaning | Demo artifact |
| --- | --- | --- | --- |
| `recipientSecret` | field element decimal string | Recipient-owned secret used in leaves, nullifier, and recipient commitment. | `alice-private-inputs.debug.json` |
| `identityHash` | field element decimal string | Private identity/KYC-derived value. | `alice-private-inputs.debug.json` |
| `leafSalt` | field element decimal string | Per-eligibility-leaf blinding salt. | `alice-private-inputs.debug.json` |
| `eligibilityMerklePath` | `Hex32[]` | Sibling nodes proving inclusion in the eligibility root. | `alice-private-inputs.debug.json` |
| `eligibilityMerkleIndices` | `number[]` | Eligibility Merkle path directions. | `alice-private-inputs.debug.json` |
| `complianceLeafSalt` | field element decimal string | Per-compliance-leaf blinding salt. | `alice-private-inputs.debug.json` |
| `complianceMerklePath` | `Hex32[]` | Sibling nodes proving inclusion in the compliance clearance root. | `alice-private-inputs.debug.json` |
| `complianceMerkleIndices` | `number[]` | Compliance Merkle path directions. | `alice-private-inputs.debug.json` |
| `amountSalt` | field element decimal string | Blinding salt for the amount commitment. | `alice-private-inputs.debug.json` |
| `eligibilityReason` | string | Demo-only aid rationale. Not part of circuit constraints. | `alice-private-inputs.debug.json` |
| `complianceStatus` | string | Demo-only clearance label. Not part of circuit constraints. | `alice-private-inputs.debug.json` |

Private leaf derivations:

```txt
eligibility_leaf = Poseidon(recipientSecret, identityHash, leafSalt, policyHash)
compliance_leaf  = Poseidon(recipientSecret, identityHash, complianceLeafSalt, policyHash)
```

`policyHash` currently folds the campaign policy and demo compliance provider commitment into one public field. There is no separate real KYC/sanctions provider integration.

## Public Inputs

These ten values are public signals for the Groth16 verifier.

| Input | Type | Derivation / meaning | Demo artifact |
| --- | --- | --- | --- |
| `campaignId` | `Hex32` | Campaign-scoped domain separator. | `alice-public-inputs.json` |
| `eligibilityRoot` | `Hex32` | Public Merkle root committed by campaign operator. | `alice-public-inputs.json` |
| `complianceRoot` | `Hex32` | Public compliance clearance Merkle root committed by campaign operator. | `alice-public-inputs.json` |
| `policyHash` | `Hex32` | Public commitment to campaign policy and demo compliance-provider scope. | `alice-public-inputs.json` |
| `nullifierHash` | `Hex32` | `Poseidon(recipientSecret, campaignId)`. Prevents double claims. | `alice-public-inputs.json` |
| `amount` | number | Public claim amount in this MVP. Alice uses `125`. | `alice-public-inputs.json` |
| `maxAmount` | number | Campaign per-recipient cap. Demo cap is `250`. | `alice-public-inputs.json` |
| `amountCommitment` | `Hex32` | `Poseidon(amount, amountSalt, campaignId)`. Kept for future confidential amounts. | `alice-public-inputs.json` |
| `recipientCommitment` | `Hex32` | `Poseidon(recipientSecret, policyHash, payoutAccountHash)`. Prevents payout-address swapping without revealing recipient identity. | `alice-public-inputs.json` |
| `payoutAccountHash` | `Hex32` | SHA-256 of canonical Stellar payout address, encoded as a BN254-safe field element. | `alice-public-inputs.json` |

The public payout recipient address is also sent to the relayer and contract as a public Stellar `G...`/`C...` address. It is not a private witness value.

The circuit public signal order is:

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

snarkjs writes ordered public signals to:

```txt
circuits/claim/build/alice-public.json
```

## Circuit Inputs

The Circom witness input is written to:

```txt
circuits/claim/build/alice-input.json
```

It uses exact `claim.circom` signal names and decimal field strings:

```txt
recipient_secret
identity_hash
leaf_salt
eligibility_merkle_path
eligibility_merkle_indices
compliance_leaf_salt
compliance_merkle_path
compliance_merkle_indices
amount_salt
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

## Reproducibility Checks

`pnpm zk:verify:local` asserts:

| Check | Expected |
| --- | --- |
| Alice valid Groth16 proof verifies | `true` |
| Eligible and compliant recipients can produce valid witnesses | `true` |
| Eligible but non-compliant Eve cannot produce a valid witness | `true` |
| Synthetic compliant-but-ineligible Mallory cannot produce a valid witness | `true` |
| Mallory with Alice's paths cannot generate a valid witness | `true` |
| Tampered compliance path cannot generate a valid witness | `true` |
| Over-cap amount cannot generate a valid witness | `true` |
| Tampered public input fails verification | `true` |
| Wrong eligibility root fails verification | `true` |
| Wrong compliance root fails verification | `true` |
| Wrong campaign ID fails verification | `true` |
| Wrong policy/provider hash fails verification | `true` |
| Tampered proof fails verification | `true` |

Full check output is written to:

```txt
circuits/claim/build/verification-report.json
```

## Browser Public ZK Artifacts

`pnpm web:zk:prepare` copies only public proving artifacts to:

```txt
apps/web/public/zk/claim.wasm
apps/web/public/zk/claim_final.zkey
apps/web/public/zk/verification_key.json
apps/web/public/zk/zk-manifest.json
```

It does not copy `.wtns` files, witness JSON, private input JSON, recipient secrets, Merkle path fixture files, or compliance private paths. `pnpm web:zk:clean` removes only those browser public ZK files. The directory is ignored because these are generated artifacts.

## Browser Testnet Relayer Payload

`/api/testnet/claim` accepts only:

```json
{
  "proofEncodingForSoroban": "...",
  "publicInputs": {
    "campaignId": "0x...",
    "eligibilityRoot": "0x...",
    "complianceRoot": "0x...",
    "policyHash": "0x...",
    "nullifierHash": "0x...",
    "amountCommitment": "0x...",
    "recipientCommitment": "0x...",
    "payoutAccountHash": "0x...",
    "amount": 100,
    "maxAmount": 250
  },
  "payoutRecipient": "G...",
  "campaignContractId": "C...",
  "campaignId": "0x..."
}
```

The route rejects private witness field names such as `recipient_secret`, `identity_hash`, `leaf_salt`, `compliance_leaf_salt`, `amount_salt`, Merkle paths, witness data, or `privateInputs`. It recomputes `payoutAccountHash` from the public `payoutRecipient`, validates the active campaign roots, and rejects mismatches before submitting to Stellar.

## Soroban Verifier Inputs

The default Soroban verifier contract verifies the same `claim_v0` Groth16 proof against the embedded deterministic development verification key. Contract proof bytes are encoded as:

```txt
A(G1 64 bytes) || B(G2 128 bytes) || C(G1 64 bytes)
```

The campaign contract computes the payout recipient hash from the Soroban `Address`, checks it equals `ClaimPublicInputs.payout_account_hash`, checks the campaign ID, eligibility root, compliance root, policy hash, cap, and nullifier, and then passes the public inputs into the verifier. The verifier maps them back to the circuit public signal order shown above before running the BN254 pairing check.

## Dev-Only Proof Envelope

The TypeScript package `@lumen-aid/prover` still supports a deterministic `dev_verifier` envelope for Local Demo mode and the local Soroban-shaped simulator. It is not Groth16. Callers must explicitly pass:

```ts
mode: "dev_verifier"
```

The explicit dev artifact command is:

```bash
pnpm zk:build:dev
```

It may skip Circom compilation and prints a large warning. Real local ZK validation uses `zk:build`, `zk:prove:demo`, `zk:verify:local`, and `zk:verify:compliance`.
