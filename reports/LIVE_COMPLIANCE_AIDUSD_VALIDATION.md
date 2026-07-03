# Live Compliance AIDUSD Validation

Date: 2026-07-02
Environment: Windows PowerShell, workspace `C:\Users\TEKNES\Desktop\lumen`

Overall status: PASS WITH DISCLOSURE

- AIDUSD live testnet payout: validated.
- Fresh compliance deployment: validated.
- Browser compliance e2e: validated.

## Product Claim Validated

Lumen performs a live AIDUSD compliance-aware private aid payout on Stellar testnet:

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

Disclosures: deterministic development trusted setup, demo compliance roots, no real KYC/sanctions provider integration, local testnet relayer, no direct Freighter signing, public amounts, no production audit, and no mainnet support.

## Final Active AIDUSD Deployment

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
| Verification key hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` |
| Final stats | `claim_count=3`, `total_claimed=600`, `remaining_budget=400` |

`deployments/active-testnet.json` contains public deployment metadata only. No tracked `.env`, witness, private input JSON, generated ZK build output, `node_modules`, `.next`, or `target` files were found.

## Command Results

| Command | Status | Evidence |
| --- | --- | --- |
| `stellar keys ls` | PASS | Local key names available; `admin` used as a CLI key name, not a secret key or public address. |
| `pnpm stellar:doctor` | PASS | Env loaded from dotenv; CLI, Rust, target, testnet network, and source account key resolved. |
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date with `dotenv`. |
| `pnpm typecheck` | PASS | Shared, merkle, prover, stellar, and web typechecks passed. |
| `pnpm test` | PASS WITH DISCLOSURE | Initial 5-minute tool timeout; rerun with longer timeout passed: ZK 8/8, merkle 7/7, prover 9/9, stellar 3/3. |
| `pnpm contracts:build` | PASS WITH DISCLOSURE | WASM artifacts built; known generated-constant and Soroban event deprecation warnings remain. |
| `pnpm contracts:test:compliance` | PASS WITH DISCLOSURE | Verifier 8/8, campaign 13/13, mock token 1/1. |
| `pnpm zk:doctor` | PASS | Node, pnpm, Circom, snarkjs, and source/artifacts checked. |
| `pnpm zk:clean` | PASS | Removed generated ZK build artifacts. |
| `pnpm zk:setup` | PASS | Project-local Circom 2.2.3 available. |
| `pnpm zk:build` | PASS WITH DISCLOSURE | Clean rerun passed: 10 public inputs, 17 private inputs, 6,394 constraints. A timed-out orphaned setup process from the first attempt was stopped before the clean rerun. |
| `pnpm zk:prove:demo` | PASS | Alice Groth16 proof generated and locally verified. |
| `pnpm zk:verify:local` | PASS | Alice passes; Eve, Mallory, wrong roots, wrong policy, over-cap, tampered public input, and tampered proof fail. |
| `pnpm zk:verify:compliance` | PASS | Compliance wrapper passed. |
| `pnpm web:zk:prepare` | PASS | Public browser ZK artifacts copied; private witness data not copied. |
| `pnpm stellar:asset:doctor:testnet` | PASS | AIDUSD code, public issuer, distributor key name, asset string, and SAC ID resolved. |
| `pnpm stellar:asset:setup-aidusd:testnet` | PASS | Trustline, issued testnet AIDUSD, SAC deploy/resolve, and distributor SAC balance passed. |
| `pnpm stellar:fresh-aidusd-campaign:testnet` | PASS | Fresh verifier/campaign deployed, complianceRoot included, AIDUSD escrow funded. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Read campaign config, roots, verifier, asset/SAC, escrow, and recipient balances. |
| `pnpm stellar:smoke:aidusd:testnet` | PASS | Charlie proof generated, local verification passed, state-changing AIDUSD payout accepted; duplicate rejected with no second transfer. |
| `pnpm stellar:smoke:compliance:testnet` | PASS | Alice proof generated after Charlie; state-changing payout accepted; duplicate/no-transfer and negative/tamper checks passed. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next production build passed, including `/auditor`. |
| `pnpm build` | PASS | Full workspace build passed. |
| `pnpm web:e2e:compliance:testnet` | PASS WITH DISCLOSURE | Dora browser proof/local verification/relayed claim passed; duplicate rejected; Eve and Mallory failed before submission; donor refresh and auditor package shown. Node emitted a dependency `Buffer()` deprecation warning. |
| `pnpm privacy:audit` | PASS WITH DISCLOSURE | Private-field rejection, payout binding, stale deployment guards, no-transfer ordering, and debug warning checks passed. |

## Live Smoke Details

State-changing testnet operations:

- Charlie AIDUSD payout accepted on testnet; recipient balance increased by `250`; escrow decreased by `250`.
- Charlie duplicate claim rejected with no second transfer.
- Alice AIDUSD payout accepted on testnet in the compliance smoke; recipient balance increased by `250`; escrow decreased by `250`.
- Alice duplicate claim rejected with no second transfer.
- Dora browser e2e payout accepted on testnet; donor dashboard refreshed; duplicate Dora claim rejected.

No-send or pre-submission negative checks:

- Swapped payout recipient rejected.
- Tampered payout hash rejected.
- Wrong eligibility root rejected.
- Wrong compliance root rejected.
- Wrong policy rejected.
- Malformed proof rejected.
- Over-cap witness rejected.
- Eve non-compliant proof generation failed.
- Mallory ineligible proof generation failed.

## Final Report Table

| Area | Status | Evidence | Risk | Decision |
| --- | --- | --- | --- | --- |
| Git hygiene | PASS WITH DISCLOSURE | Dirty worktree allowed; no tracked secret/private/generated dangerous files found. | Review before commit. | Proceed. |
| ZK clean build | PASS WITH DISCLOSURE | Clean build passed after rerun; 10 public inputs, 17 private inputs, 6,394 constraints. | Deterministic development setup. | Accept with disclosure. |
| Compliance circuit | PASS | Eligibility + compliance membership, cap, nullifier, amount commitment, and payout binding verified. | Demo compliance data. | Accept. |
| Public/private input docs | PASS | Docs describe 10 public inputs and 17 private witness fields. | Keep in sync with circuit changes. | Accept. |
| Browser proof generation | PASS | Browser worker generated Dora proof in e2e. | Heavy browser proving; timeout may need tuning on slow machines. | Accept. |
| Browser local verification | PASS | Browser local Groth16 verification passed before relayer submission. | Development VK. | Accept. |
| Soroban verifier | PASS WITH DISCLOSURE | `verifier_info` reports `real_groth16`; tests and live claims passed. | Development verification key. | Accept with disclosure. |
| Campaign compliance checks | PASS | Wrong roots/policy/payout/proof rejected before transfer. | Negative live checks are no-send except duplicates. | Accept. |
| AIDUSD/SAC setup | PASS | Asset setup and SAC contract resolved: `CBRLWL...QTLQ`. | Testnet issued asset. | Accept. |
| Fresh compliance deployment | PASS | Active deployment includes AIDUSD mode, `complianceRoot`, and current VK hash. | Public metadata only. | Accept. |
| Escrow funding | PASS | Campaign escrow funded with `1000` AIDUSD; final escrow `400`. | Testnet value only. | Accept. |
| Positive compliant AIDUSD payout | PASS | Charlie, Alice, and Dora accepted across CLI/browser validation. | Public amount/address. | Accept. |
| Recipient balance increase | PASS | Smoke/e2e asserted balance deltas for accepted claims. | Recipient balances are cumulative across campaigns. | Accept using deltas. |
| Escrow balance decrease | PASS | Smoke/e2e asserted escrow deltas; final remaining budget/escrow `400`. | Testnet only. | Accept. |
| Duplicate rejection no transfer | PASS | Charlie/Alice CLI duplicates and Dora browser duplicate rejected with unchanged balances. | Failed txs do not persist duplicate counters. | Accept. |
| Eve non-compliant rejection | PASS | CLI/browser proof generation fails for Eve compliance clearance. | Demo clearance root only. | Accept. |
| Mallory ineligible rejection | PASS | CLI/browser proof generation fails for Mallory eligibility. | Demo eligibility root only. | Accept. |
| Swapped payout rejection | PASS | Relayer/campaign payout binding rejected swap. | Payout address remains public. | Accept. |
| Tampered compliance root/path rejection | PASS | Local and live no-send wrong compliance root/path checks passed. | Live tamper is no-send simulation. | Accept with disclosure. |
| Browser compliance e2e | PASS WITH DISCLOSURE | Dora proof, claim, duplicate, Eve/Mallory, donor, auditor passed. | Dependency deprecation warning observed. | Accept. |
| Donor live AIDUSD dashboard | PASS | Browser e2e checked AIDUSD, compliance root, escrow, totals, and refresh. | Browser-session last tx storage is local. | Accept. |
| Auditor selective disclosure | PASS WITH DISCLOSURE | Auditor page loaded Dora package and commitment. | Demo-only, not view keys. | Accept with disclosure. |
| Privacy audit | PASS WITH DISCLOSURE | `pnpm privacy:audit` passed relayer, browser, contract, and debug checks. | Local testnet relayer. | Accept. |
| Secret audit | PASS | No dangerous tracked files found; `.env` ignored. | Manual review still required before commit. | Accept. |
| Full workspace build | PASS | `pnpm build` passed. | None observed. | Accept. |

## Decision

PASS WITH DISCLOSURE. Live AIDUSD/fresh compliance testnet blockers are closed. Do not describe the system as production, mainnet-ready, audited, or integrated with a real compliance provider.
