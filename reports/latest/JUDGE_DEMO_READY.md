# Judge Demo Ready

Date: 2026-07-03T12:06:39.681Z

Judge demo campaign: READY

Demo URL: http://localhost:3000/demo

Purpose: create a fresh AIDUSD compliance-aware campaign and leave it pristine for the judge walkthrough.

## Commands

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm stellar:fresh-aidusd-campaign:testnet` | PASS | Fresh pristine demo campaign deployed and funded. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Fresh demo campaign is readable. |

## Public Deployment Metadata

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Asset mode | `aidusd_sac` |
| Asset code | `AIDUSD` |
| AIDUSD/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign contract | `CD6BWJYNDJPSK4LDKICLSV4IDN7XXHNE3BYA4V7KYMPA4SNAYBQ4UFE4` |
| Verifier contract | `CCRODRGI5YO73MBYDN2ITFQETE2I6V3NVX7S7YVXTZQ4XJ3UOUY4SUGI` |
| Campaign ID | `0x009cffdb9006effc1fc6f0b1badc2136a182d8e38aee74808f11f2171595524e` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| VK hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` |
| Escrow balance | `1000` |

## Demo State

Campaign state: pristine. `claim_count=0`, `total_claimed=0`, `remaining_budget=1000`.
Dora available for valid claim: yes.
Eve available for non-compliant rejection: yes, based on pristine aggregate claim count and demo recipient config. No valid Eve claim status is faked.
Mallory available for ineligible rejection: yes, based on pristine aggregate claim count and demo recipient config. No valid Mallory claim status is faked.

## Suggested Demo Sequence

1. Open `/demo`.
2. Open Donor dashboard.
3. Open Recipient.
4. Claim as Dora.
5. Try duplicate Dora.
6. Try Eve non-compliant.
7. Try Mallory ineligible.
8. Open Donor dashboard again.
9. Open Auditor disclosure.

## Disclosures

- Testnet only.
- Deterministic development trusted setup and verification key.
- Demo eligibility and compliance roots only.
- No production audit.
- No real KYC/sanctions provider integration.
- No mainnet support.
- Public amounts and public payout addresses.
- Local testnet relayer.
- Selective disclosure package is demo-only, not production view keys.

Deployment metadata written to `C:\Users\TEKNES\Desktop\lumen\deployments\demo-testnet.json`. `deployments/active-testnet.json` is also the intended current demo state because the fresh campaign script writes the active deployment.

