# Lumen

Private, ZK-compliant aid disbursements on Stellar.

## One-liner

Lumen lets aid recipients privately prove eligibility and compliance clearance, then receive AIDUSD testnet payouts through a Soroban-verified campaign escrow.

## What is working now

- Browser Groth16 proof generation.
- Browser local verification.
- Eligibility + compliance Merkle membership proof.
- Proof-bound payout recipient.
- AIDUSD/SAC escrow payout on Stellar testnet.
- Soroban verifier/campaign checks.
- Duplicate rejection.
- Non-compliant Eve rejection.
- Ineligible Mallory rejection.
- Swapped payout rejection.
- Donor live dashboard.
- Auditor selective disclosure demo package.

## Product flow

```txt
Operator -> eligibility/compliance roots -> recipient browser proof -> relayer -> Soroban verifier/campaign -> AIDUSD escrow payout -> donor/auditor views
```

## Public vs private

| Data | Visibility | Purpose |
| --- | --- | --- |
| Recipient secret, identity hash, salts | Private witness | Builds leaves, nullifier, commitments, and amount commitment. |
| Eligibility Merkle path and indices | Private witness | Proves membership in the public eligibility root. |
| Compliance Merkle path and indices | Private witness | Proves membership in the public compliance root. |
| Campaign ID | Public | Campaign domain separator. |
| Eligibility root | Public | Operator commitment to eligible recipients. |
| Compliance root | Public | Operator commitment to compliance-cleared recipients. |
| Policy hash | Public | Campaign policy and demo provider-scope commitment. |
| Nullifier hash | Public | Duplicate-claim prevention. |
| Amount and max amount | Public | Testnet payout amount and cap. |
| Amount commitment | Public | Future-compatible commitment; amounts are still public now. |
| Recipient commitment | Public | Recipient commitment without identity disclosure. |
| Payout address and payout account hash | Public | Stellar recipient is public and proof-bound. |
| Groth16 proof | Public | Verified locally in browser and by the Soroban verifier/campaign path. |

The circuit has 10 public inputs and 17 expanded private witness fields for the fixed-depth demo trees.

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

## How to run

Install and build:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Prepare and verify the ZK path:

```bash
pnpm zk:build
pnpm zk:prove:demo
pnpm zk:verify:compliance
pnpm web:zk:prepare
```

Check contracts and active AIDUSD testnet state:

```bash
pnpm contracts:test:compliance
pnpm stellar:doctor
pnpm stellar:aidusd:active:testnet
pnpm privacy:audit
```

Run the web app:

```bash
pnpm dev
```

Open `http://localhost:3000/demo` for the guided command center.

## Live testnet validation

Final active deployment, validated on July 2, 2026:

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Asset mode | `aidusd_sac` |
| Asset code | `AIDUSD` |
| Asset issuer | `GDOY2OM6324SAIHXFGTNHYJMKMA25RTTVW2OGIDXO7DMRNVLKPBYB5ZM` |
| Asset/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign contract | `CCB3V5JB64RIWDAPGPVNKF4QXO5STRJNSXRUUPHH4VGVFK5LGE565UKD` |
| Verifier contract | `CC7HT7LR3GKER5PQC6MUE2ULEJHOJKS73QNDLS5YTGYIC5LZ3UL2TYMM` |
| Campaign ID | `0x00d3e6d2d2243b8c551742912260d31ed8f599645c993bdf89e25140fcf6d2b6` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| Verifier mode | `real_groth16` |
| Verification key hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` AIDUSD |
| Final stats | `claim_count=3`, `total_claimed=600`, `remaining_budget=400` |

Canonical evidence:

- `reports/latest/LIVE_COMPLIANCE_AIDUSD_VALIDATION.md`
- `reports/latest/FULL_PRODUCT_VALIDATION.md`
- `reports/latest/COMPLIANCE_STABLECOIN_UPGRADE.md`
- `reports/latest/PRIVACY_AUDIT.md`
- `reports/latest/PRODUCT_FREEZE_AND_POLISH.md`

## Disclosures

- Deterministic development trusted setup.
- Demo compliance roots.
- No real KYC/sanctions provider integration.
- Local testnet relayer.
- Public amounts.
- Public payout addresses.
- No direct Freighter signing.
- No production audit.
- No mainnet support.
- AIDUSD is a testnet issued asset.
- Auditor package is demo-only, not real view keys.

## Repository structure

```txt
apps/web              Next.js product UI and /demo command center
contracts/campaign    Soroban campaign escrow and claim checks
contracts/verifier    Soroban real_groth16 verifier plus explicit dev feature
contracts/mock_token  Legacy/local demo helper, not the main payout path
circuits/claim        Compliance-aware Circom claim circuit and ZK scripts
packages/shared       Domain types and deterministic fixtures
packages/merkle       Poseidon trees, roots, nullifiers, and commitments
packages/prover       Local dev envelope adapter and verification helpers
packages/stellar      Stellar/Soroban client helpers
scripts               ZK, Stellar, privacy, and browser e2e commands
docs                  Canonical technical docs and limitations
reports/latest        Current judge-facing validation evidence
reports/archive       Historical reports from earlier product states
deployments           Public testnet deployment metadata only
```

Lumen is a testnet prototype. Do not describe it as production-ready, audited, mainnet-ready, or integrated with a real compliance provider.
