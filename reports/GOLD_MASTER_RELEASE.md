# Gold Master Release

Date: 2026-07-03
Environment: Windows PowerShell, workspace `C:\Users\TEKNES\Desktop\lumen`

Overall status: PASS WITH DISCLOSURE

Judge demo campaign: READY

## Validated Product State

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

## Final Validation

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date. |
| `pnpm typecheck` | PASS | Shared, merkle, prover, stellar, and web typechecks passed. |
| `pnpm test` | PASS | ZK tests 8/8; merkle 7/7; prover 9/9; stellar 3/3. |
| `pnpm contracts:test:compliance` | PASS WITH DISCLOSURE | Verifier 8/8, campaign 13/13, mock token 1/1; existing Rust warnings only. |
| `pnpm zk:verify:compliance` | PASS | Valid proof accepted; wrong roots, policy, campaign, public input, proof, Eve, Mallory, and over-cap cases rejected. |
| `pnpm web:zk:prepare` | PASS | Browser ZK artifacts copied; private witness/private input files not copied. |
| `pnpm judge:validate:testnet` | PASS WITH DISCLOSURE | Fresh validation campaign consumed Charlie/Alice/Dora and passed dashboard/auditor/privacy checks. |
| `pnpm judge:prepare-demo:testnet` | PASS WITH DISCLOSURE | Fresh demo campaign created, funded, verified pristine, and written to `deployments/demo-testnet.json`. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Active demo campaign readable with `1000` AIDUSD escrow. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next production build passed. |
| `pnpm build` | PASS | Full workspace build passed. |
| `pnpm privacy:audit` | PASS WITH DISCLOSURE | Relayer/browser/contract/debug privacy checks passed. |

## Judge Validation Campaign

Canonical report: `reports/latest/JUDGE_VALIDATION_RUN.md`

| Field | Value |
| --- | --- |
| Campaign contract | `CDGUIKFRNKQMWL5PYUQ37DX2SIO6LAKV6KEI33J2DIEKZQATA7CSRIG6` |
| Verifier contract | `CAL6HJ5MXQLEL4LAKG5Y5YMHIMNPEG3BFQQ2UICY6SJ6P5FPWXFL5XHJ` |
| AIDUSD/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign ID | `0x007e07d773d19eb6df1e3ce0d187cc32becf283181d1630f6ce729477f86e07f` |
| Final state | `claim_count=3`, `total_claimed=600`, `remaining_budget=400`, `escrow=400` |

## Pristine Demo Campaign

Canonical report: `reports/latest/JUDGE_DEMO_READY.md`

| Field | Value |
| --- | --- |
| Demo URL | `http://localhost:3000/demo` |
| Campaign contract | `CCS7WTPLZI36VSQU2T3EKJRNJKGBYMRKNAVAFMSTPL2CJWCMNG2HJSZH` |
| Verifier contract | `CDK6HSLEZRVIHLLQSEH6LQGXBHYNPL7VXO3W4QN4WVB4C4R5A466SYQZ` |
| AIDUSD/SAC contract | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign ID | `0x00405cc1adafb8ac4ea9b6a8f390d2a2f9565304765480dd4da3c3ff33bce37c` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| VK hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow | `1000` |
| State | `pristine`; `claim_count=0`, `total_claimed=0`, `remaining_budget=1000` |

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
