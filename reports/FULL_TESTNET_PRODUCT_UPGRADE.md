# Lumen Full Testnet Product Upgrade

## Baseline status before changes

Date: 2026-07-02

Environment restored before baseline:

- `stellar keys ls`: passed; local keys include `admin`.
- `STELLAR_NETWORK=testnet` and `STELLAR_SOURCE_ACCOUNT=admin` were set for the shell commands.
- `pnpm stellar:doctor`: passed; Stellar CLI, Rust, wasm target, testnet network, and `admin` source account key were available.

Dirty worktree at baseline was accepted as expected:

```txt
 M .gitignore
 M apps/web/app/donor/donor-client.tsx
 M apps/web/app/page.tsx
 M deployments/testnet-alice-duplicate-claim.json
 M package.json
 M packages/stellar/src/index.ts
 M reports/FULL_PRODUCT_VALIDATION.md
?? apps/web/lib/testnet-state.ts
?? deployments/testnet-bob-claim.json
?? deployments/testnet-bob-public-inputs.arg.json
?? reports/FRONTEND_STATE_VALIDATION.md
?? reports/RELEASE_HYGIENE.md
?? reports/TESTNET_VALIDATION.md
?? scripts/stellar-claim-bob-testnet.ts
?? scripts/stellar-read-testnet.ts
```

Dangerous-file check:

- No tracked `.env`, `.env.local`, private keys, witness files, private input JSON, generated ZK build output, `node_modules`, `.next`, or `target` files were found.
- Ignored local dangerous artifacts were present and not blockers: `.env`, `.tools/`, `apps/web/.next/`, `node_modules/`, package `node_modules/`, `circuits/claim/build/`, and `target/`.

Baseline commands:

| Command | Result | Evidence |
| --- | --- | --- |
| `git status --short` | PASS | Dirty state recorded above; no dangerous tracked files detected. |
| `pnpm typecheck` | PASS | All workspace TypeScript projects completed `tsc --noEmit`. |
| `pnpm test` | PASS | Root ZK tests passed; package test suites passed or had no tests. |
| `pnpm contracts:test` | PASS | Verifier 6/6, campaign 10/10, mock token 1/1 passed. Existing Soroban event deprecation warnings only. |
| `pnpm zk:doctor` | PASS | Node, pnpm, circom, snarkjs, claim circuit, build artifacts, and demo proof artifacts detected. |
| `pnpm zk:build` | PASS | Circom compilation and deterministic Groth16 setup completed; verification key exported. |
| `pnpm zk:prove:demo` | PASS | Alice proof generated and verified locally with Groth16. |
| `pnpm zk:verify:local` | PASS | Alice valid proof passed; Mallory, over-cap, tampered public input, wrong root, wrong campaign, wrong policy, and tampered proof failed as expected. |
| `pnpm stellar:doctor` | PASS | Testnet CLI/account checks passed with `admin`. |
| `pnpm stellar:read:testnet` | PASS | Existing campaign and verifier callable on testnet; campaign stats showed total claimed `300`, claim count `2`, remaining budget `700`. |
| `pnpm build` | PASS | Workspace build passed; Next.js production build generated routes for `/`, `/debug`, `/donor`, `/operator`, and `/recipient`. |

## Product upgrade implemented

Changes completed after the baseline:

- Added `verifier_info()` to the verifier contract with deterministic verifier/circuit/verification-key hashes, `mode`, and `version`.
- Added default and `dev_verifier` feature tests for verifier self-identification.
- Updated testnet read clients to call `verifier_info()` when available and label old deployments as `Verifier mode: legacy verifier, mode not introspectable`.
- Added `pnpm stellar:fresh-campaign:testnet` and `pnpm stellar:active:testnet`.
- Added testnet-only active recipients Alice, Bob, Charlie, Dora, and ineligible Mallory.
- Added `pnpm web:zk:prepare` and `pnpm web:zk:clean` for public browser proving artifacts.
- Added browser Groth16 proving in a Web Worker with local verification and timing results.
- Added `/api/testnet/config` and `/api/testnet/claim`.
- Upgraded `/recipient` with Real Testnet Claim, Local Demo, and Debug modes.
- Upgraded `/donor` to read the active testnet deployment and refresh after browser claims.
- Added `pnpm stellar:smoke:testnet:full`.
- Added `pnpm web:e2e:testnet`.
- Added `pnpm privacy:audit` and `reports/PRIVACY_AUDIT.md`.

## Validation during implementation

| Command | Result | Evidence |
| --- | --- | --- |
| `cargo test -p lumen_verifier && cargo test -p lumen_verifier --features dev_verifier` | PASS | Default verifier reports `real_groth16`; dev feature reports `dev_verifier`; info stable across calls. |
| `pnpm typecheck` | PASS | Workspace TypeScript passed after shared, Stellar, web worker, route, and UI changes. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next build includes `/api/testnet/claim` and `/api/testnet/config`. |
| `pnpm web:zk:prepare` | PASS | Public proving artifacts copied and hashed; private witness/private input files not copied. |
| `pnpm stellar:fresh-campaign:testnet` | PASS | Fresh active campaign deployed/initialized and `deployments/active-testnet.json` written. |
| `pnpm stellar:active:testnet` | PASS | Active campaign callable; stats readable; verifier info readable as `real_groth16`; malformed proof rejected. |
| `pnpm stellar:smoke:testnet:full` | PASS | Charlie proof/claim accepted, duplicate rejected, Mallory/wrong root/wrong policy/malformed/over-cap rejected, final stats correct. |
| `pnpm web:e2e:testnet` | PASS | Dora browser proof generated and locally verified; relayer submitted testnet claim; duplicate Dora rejected; Mallory rejected before submission. |
| `pnpm privacy:audit` | PASS | Privacy checks passed and report written. |
| Final `pnpm build` | PASS | Full workspace build passed with dynamic testnet API routes. |
| Final `pnpm stellar:active:testnet` | PASS | Post-validation stats: total claimed `250`, claim count `2`, remaining budget `750`. |

## Final target status

PASS WITH DISCLOSURE

The product goal is met for testnet:

```txt
Browser real Groth16 proof
-> browser local verification
-> browser-submitted Stellar testnet claim
-> Soroban verifier/campaign
-> live donor dashboard refresh
```

Disclosure remains required for deterministic development trusted setup, mock token, local demo simulator, `dev_verifier` feature path, missing Freighter mode, no production audit, and no mainnet support.

## Final report table

| Area | Status | Evidence | Risk | Decision |
| --- | --- | --- | --- | --- |
| Git hygiene | PASS | Dangerous tracked-file checks clean; generated/env/private artifacts ignored. | Dirty worktree expected. | Continue. |
| ZK clean build | PASS WITH DISCLOSURE | `zk:build` real Circom/Groth16 path passes. | Deterministic setup. | Disclose. |
| CLI proof generation | PASS | `zk:prove:demo` and smoke Charlie proof pass. | Demo fixtures. | Accept for testnet. |
| CLI local verification | PASS | `zk:verify:local` and smoke verification pass. | None for claimed scope. | Accept. |
| Browser ZK assets | PASS WITH DISCLOSURE | `web:zk:prepare` copies public artifacts and manifest only. | Generated artifacts ignored. | Accept with disclosure. |
| Browser proof generation | PASS | E2E generated Dora proof in browser worker. | Browser performance varies. | Accept for testnet. |
| Browser local verification | PASS | E2E local Groth16 verification passed. | None for claimed scope. | Accept. |
| Soroban verifier contract | PASS WITH DISCLOSURE | Real Groth16 verifier deployed and exercised. | Development verification key. | Disclose. |
| Verifier info introspection | PASS | `verifier_info()` reports `real_groth16`, `claim_v0`. | Old verifier remains legacy. | UI labels legacy. |
| Fresh campaign creation | PASS | `stellar:fresh-campaign:testnet` writes active deployment. | Testnet only. | Accept. |
| Testnet positive claim | PASS | Charlie CLI and Dora browser claims accepted. | Testnet only. | Accept. |
| Testnet duplicate rejection | PASS | Charlie and Dora duplicates rejected. | Failed tx/simulation output can be verbose. | Accept. |
| Testnet wrong root/wrong policy | PASS | Smoke rejects both with contract errors. | Simulation/no-send for negatives. | Accept. |
| Testnet malformed proof | PASS | Verifier simulation returns false. | None for claimed scope. | Accept. |
| Browser testnet claim | PASS | `/api/testnet/claim` relays proof/public inputs only. | Relayer is local demo mode, not production service. | Disclose. |
| Browser duplicate rejection | PASS | E2E duplicate Dora rejected. | Same relayer caveat. | Accept. |
| Donor live testnet dashboard | PASS | Active campaign read and refresh exercised by e2e. | Requires public testnet RPC env/default. | Accept. |
| Privacy audit | PASS | `pnpm privacy:audit` passed. | Static audit plus e2e, not external review. | Accept. |
| Secret audit | PASS | Secret-shaped source accounts refused; no keys printed/committed. | Local `.env` remains ignored. | Accept. |
| Full workspace build | PASS | Final `pnpm build` passed. | None for claimed scope. | Accept. |

## Final active testnet state

| Field | Value |
| --- | --- |
| Campaign contract ID | `CAY354EH72E5DDZDBESTBVWZGQBUWWWFT2VQPSPWSX6VM6VHVGDZNVBV` |
| Verifier contract ID | `CAGAZHB5CH3OMGK4LKP2SU2I23B4CGMFVNN4DPOHP2C5EOLETS74KIEE` |
| Mock token contract ID | `CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7` |
| Campaign ID | `0x00db21f02b2f6b410de2bb6ae97cbcf5c18bd512f2b614f9e4d78968d4e3170c` |
| Verifier mode | `real_groth16` |
| Total claimed | `250` |
| Claim count | `2` |
| Remaining budget | `750` |
