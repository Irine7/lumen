# Compliance Stablecoin Upgrade

Date: 2026-07-02
Environment: Windows PowerShell, workspace `C:\Users\TEKNES\Desktop\lumen`

Overall status: PASS WITH DISCLOSURE

- AIDUSD live testnet payout: validated.
- Fresh compliance deployment: validated.
- Browser compliance e2e: validated.

Canonical live evidence: `reports/latest/LIVE_COMPLIANCE_AIDUSD_VALIDATION.md`

## Summary

The compliance-grade stablecoin-style upgrade is validated on Stellar testnet using AIDUSD via the Stellar Asset Contract path.

Validated flow:

```txt
browser Groth16 proof
-> eligibility + compliance clearance proof
-> payout-bound recipient
-> browser local verification
-> relayed testnet submission
-> Soroban verifier/campaign
-> AIDUSD/SAC escrow transfer
-> duplicate/non-compliant/ineligible/swapped-payout rejection
-> donor live dashboard
-> auditor selective disclosure package
```

## Final Active Deployment

| Field | Value |
| --- | --- |
| Asset mode | `aidusd_sac` |
| Asset code | `AIDUSD` |
| Asset issuer | `GDOY2OM6324SAIHXFGTNHYJMKMA25RTTVW2OGIDXO7DMRNVLKPBYB5ZM` |
| Asset/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign contract | `CCB3V5JB64RIWDAPGPVNKF4QXO5STRJNSXRUUPHH4VGVFK5LGE565UKD` |
| Verifier contract | `CC7HT7LR3GKER5PQC6MUE2ULEJHOJKS73QNDLS5YTGYIC5LZ3UL2TYMM` |
| Campaign ID | `0x00d3e6d2d2243b8c551742912260d31ed8f599645c993bdf89e25140fcf6d2b6` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Verification key hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Final stats | `claim_count=3`, `total_claimed=600`, `remaining_budget=400` |

## Validation Results

| Area | Status | Evidence |
| --- | --- | --- |
| Env restoration | PASS | Scripts load `.env.local` then `.env`; `stellar:doctor` passes with a local CLI key name. |
| AIDUSD live setup | PASS | `pnpm stellar:asset:doctor:testnet` and `pnpm stellar:asset:setup-aidusd:testnet` passed. |
| Fresh compliance deployment | PASS | `pnpm stellar:fresh-aidusd-campaign:testnet` deployed/funded AIDUSD campaign with `complianceRoot`. |
| CLI AIDUSD smoke | PASS | Charlie payout and duplicate rejection passed with balance/escrow deltas. |
| CLI compliance smoke | PASS | Alice payout and duplicate rejection passed; Eve/Mallory/tamper checks rejected. |
| Browser compliance e2e | PASS WITH DISCLOSURE | Dora browser proof, local verification, relayed claim, duplicate rejection, Eve/Mallory failures, donor refresh, and auditor package passed. Node emitted a dependency `Buffer()` deprecation warning. |
| Privacy audit | PASS WITH DISCLOSURE | `pnpm privacy:audit` passed after live validation. |

## Disclosures

- AIDUSD is a testnet issued asset, not production money.
- Deterministic development trusted setup and verification key.
- Demo eligibility and compliance roots only.
- No real KYC/sanctions provider integration.
- Local testnet relayer; no direct Freighter signing.
- Public amounts and public payout addresses.
- No production audit and no mainnet support.
- Native testnet XLM SAC fallback remains preserved.
