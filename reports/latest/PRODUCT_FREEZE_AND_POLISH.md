# Product Freeze And Polish

Date: 2026-07-02
Environment: Windows PowerShell, workspace `C:\Users\TEKNES\Desktop\lumen`

Overall status: PASS WITH DISCLOSURE

## Protocol Freeze Check

No protocol feature changes were made. The claim circuit, verifier logic, campaign payout rules, asset modes, mainnet posture, trusted setup posture, and KYC/provider posture remain frozen.

Smallest necessary fix:

- `circuits/claim/scripts/zk.test.ts`: extended the negative missing-compiler test timeout to match the child command timeout. The ZK pipeline itself was already passing; only the Vitest harness timeout was failing.
- `circuits/claim/scripts/zk.test.ts`: extended the real `zk:build` child timeout and suite timeout after a slower final Groth16 setup run reached the child timeout before printing the success line. No circuit, verifier, campaign, or asset-mode logic changed.

## Baseline Command Results

| Command | Status | Notes |
| --- | --- | --- |
| `git status --short` | PASS WITH DISCLOSURE | Existing dirty worktree present before polish; handled without reverting unrelated work. |
| `pnpm typecheck` | PASS | Shared, merkle, prover, stellar, and web typechecks passed. |
| `pnpm test` | PASS WITH DISCLOSURE | Initial timeout exposed the harness issue; rerun passed ZK 8/8, merkle 7/7, prover 9/9, stellar 3/3. Vitest emitted a close-timeout warning after no-test web package exit, but command exited 0. |
| `pnpm contracts:test:compliance` | PASS WITH DISCLOSURE | Verifier 8/8, campaign 13/13, mock token 1/1. Existing Rust warnings remain. |
| `pnpm zk:verify:compliance` | PASS | Alice passed; Eve, Mallory, tampered roots/path/policy, over-cap, public-input tamper, and proof tamper failed. |
| `pnpm web:zk:prepare` | PASS | Public browser artifacts copied; private witness/input artifacts not copied. |
| `pnpm stellar:doctor` | PASS | Stellar CLI, Rust, wasm target, testnet network, and `admin` key name resolved. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Active AIDUSD/SAC campaign readable; escrow balance `400`; recipients and roots matched active deployment. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next production build passed. |
| `pnpm build` | PASS | Full workspace build passed. |
| `pnpm privacy:audit` | PASS | Relayer privacy, payout binding, stale deployment guards, no-transfer ordering, and debug warning checks passed. |

## Polish Changes

- Canonical docs cleaned for current AIDUSD compliance-aware state.
- README rewritten as the main judge-facing technical document.
- Historical reports moved to `reports/archive/` and marked historical.
- Latest-report structure created under `reports/latest/`.
- `/demo` command center added as a guided product launcher.
- Landing page first screen updated with the four-step product explanation and disclosure badges.
- Recipient page guided scenario panel added for Dora, duplicate Dora, Eve, Mallory, and payout swap.
- Donor page kept live AIDUSD testnet state as the default and added stable metric selectors.
- Auditor page relabeled public donor view vs demo-only auditor selective view.
- Stable `data-testid` selectors added and compliance e2e selectors updated.

## Active AIDUSD Deployment

| Field | Value |
| --- | --- |
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
| Escrow funded | `1000` |
| Escrow balance at freeze read | `400` |

## Final Validation

Final validation was run after polish. See the final command table below.

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile already up to date. |
| `pnpm typecheck` | PASS | Shared, merkle, prover, stellar, and web typechecks passed after `/demo` narrowing fix. |
| `pnpm test` | PASS WITH DISCLOSURE | First final run hit the ZK build harness timeout during Groth16 setup; timeout was increased, rerun passed ZK 8/8, merkle 7/7, prover 9/9, stellar 3/3. |
| `pnpm contracts:test:compliance` | PASS WITH DISCLOSURE | Verifier 8/8, campaign 13/13, mock token 1/1. Existing generated-constant and Soroban event warnings remain. |
| `pnpm zk:verify:compliance` | PASS | Alice valid proof passed; Eve, Mallory, tampered compliance/eligibility/policy/campaign/public input/proof cases failed as expected. |
| `pnpm web:zk:prepare` | PASS | Public browser artifacts copied; private witness/input artifacts not copied. |
| `pnpm stellar:aidusd:active:testnet` | PASS | Read-only active AIDUSD state passed; escrow balance remains `400`; Dora is already consumed. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next production build passed and includes `/demo`. |
| `pnpm build` | PASS | Full workspace build passed. |
| Browser compliance e2e safe alternative | PASS WITH DISCLOSURE | Full `pnpm web:e2e:compliance:testnet` was not rerun because the active campaign already consumed Dora and rerun would require a fresh campaign. Non-state-changing Playwright UI smoke passed for `/`, `/demo`, `/recipient`, `/donor`, `/auditor`, and mobile `/demo`; stable test IDs were verified. |
| `pnpm privacy:audit` | PASS | Relayer privacy, payout binding, stale deployment guards, no-transfer ordering, and debug warning checks passed. |

Browser validation note: the Codex in-app browser runtime connected, but the webview timed out while attaching to a page. Regular Playwright was used as the fallback for rendered UI smoke validation.

## Required Disclosures Preserved

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
