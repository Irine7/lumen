# Judge Validation Run

Date: 2026-07-03T10:30:54.904Z

Overall status: PASS WITH DISCLOSURE

Purpose: create a fresh validation campaign, consume it with automated state-changing checks, and keep the separate demo campaign workflow available for judges.

## Commands

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm stellar:fresh-aidusd-campaign:testnet` | PASS | Fresh validation campaign deployed and funded. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Active AIDUSD campaign readable. |
| `pnpm stellar:smoke:aidusd:testnet` | PASS | AIDUSD payout smoke passed. |
| `pnpm stellar:smoke:compliance:testnet` | PASS | Compliance payout smoke passed. |
| `pnpm web:e2e:compliance:testnet` | PASS | Browser compliance e2e passed. |
| `pnpm privacy:audit` | PASS | Privacy audit passed. |

## Public Deployment Metadata

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Asset mode | `aidusd_sac` |
| Asset code | `AIDUSD` |
| AIDUSD/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign contract | `CDGUIKFRNKQMWL5PYUQ37DX2SIO6LAKV6KEI33J2DIEKZQATA7CSRIG6` |
| Verifier contract | `CAL6HJ5MXQLEL4LAKG5Y5YMHIMNPEG3BFQQ2UICY6SJ6P5FPWXFL5XHJ` |
| Campaign ID | `0x007e07d773d19eb6df1e3ce0d187cc32becf283181d1630f6ce729477f86e07f` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| VK hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` |
| Escrow balance | `400` |

## Final Contract Stats

`claim_count=3`, `total_claimed=600`, `remaining_budget=400`, `duplicate_claims_blocked=0`, `invalid_claims_blocked=0`

Campaign state after validation: partially used

## Required Scenarios

| Scenario | Status | Notes |
| --- | --- | --- |
| Fresh validation campaign created | PASS | `pnpm stellar:fresh-aidusd-campaign:testnet` created a new active AIDUSD campaign. |
| AIDUSD escrow funded | PASS | Fresh campaign funded before validation. |
| Browser Groth16 proof generated | PASS | Browser e2e generated the Dora Groth16 proof. |
| Browser local verification passed | PASS | Browser e2e locally verified the proof before submission. |
| Accepted claims | PASS | Charlie and Alice were accepted through CLI smoke; Dora was accepted through browser e2e. |
| Duplicate rejections | PASS | Charlie/Alice CLI duplicates and Dora browser duplicate were rejected with no second transfer. |
| Eve rejection | PASS | Non-compliant Eve fails pre-submission proof generation; no transaction is sent. |
| Mallory rejection | PASS | Ineligible Mallory fails pre-submission proof generation; no transaction is sent. |
| Swapped payout rejection | PASS | Swapped payout is rejected in no-send simulation before transfer. |
| Donor dashboard validation | PASS | Browser e2e opened/refreshed donor dashboard against live testnet state. |
| Auditor package validation | PASS WITH DISCLOSURE | Browser e2e loaded the demo-only selective disclosure package. |
| Privacy audit | PASS WITH DISCLOSURE | `pnpm privacy:audit` passed after validation. |

Negative-case disclosure: Eve and Mallory are rejected before submission; swapped payout/tampered cases are no-send simulation checks unless explicitly described as duplicate retry transactions.

No private witness data, recipient secrets, or secret keys are written to this report.

## Disclosures

- Testnet only.
- Deterministic development trusted setup and verification key.
- Demo eligibility and compliance roots only.
- No production audit.
- No real KYC/sanctions provider integration.
- No mainnet support.
- Public amounts and public payout addresses.
- Local testnet relayer.

