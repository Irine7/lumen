# Lumen Full Product Validation

Date: 2026-07-01
Environment: Windows, PowerShell, workspace `C:\Users\TEKNES\Desktop\lumen`

Overall status: PARTIAL

Reason: local ZK, contracts, package tests, frontend build, production frontend smoke, and deterministic demo passed after minimal fixes. Fresh Stellar testnet validation is BLOCKED by missing environment/source account, and this workspace is not a Git worktree.

## 0. Validation Rules Applied

- Commands were run from package scripts wherever available.
- Failed or incomplete checks are labeled FAIL, PARTIAL, or BLOCKED.
- Dev verifier use is explicitly labeled.
- No private keys were printed.
- Code was modified only to fix validation coverage, verifier/claim safety, simulator parity, and demo disclosure.

Changed files:

| File | Why |
| --- | --- |
| `circuits/claim/scripts/verify-local.ts` | Added required wrong eligibility root negative verification case. |
| `circuits/claim/scripts/zk.test.ts` | Added regression assertion for wrong eligibility root verification case. |
| `contracts/campaign/src/lib.rs` | Fixed campaign claim flow to reject mismatched `campaign_id` before verifier/nullifier acceptance. |
| `contracts/campaign/tests/campaign.rs` | Added campaign-id mismatch regression test. |
| `packages/stellar/src/index.ts` | Aligned local Soroban-shaped simulator with contract checks for `campaignId` and `maxAmount`. |
| `packages/stellar/src/index.test.ts` | Added simulator regression coverage for wrong campaign ID and wrong max amount. |
| `scripts/demo-e2e.ts` | Removed overclaim that `demo:e2e` exercises on-chain verification; now says on-chain verification is not exercised by that local command. |

## 1. Initial Repository Sanity Check

| Item | Result |
| --- | --- |
| `git status --short` | BLOCKED: `fatal: not a git repository` |
| Current branch | BLOCKED: not a Git worktree |
| Modified/untracked before validation | BLOCKED: no Git metadata available |
| Node version | PASS: `v22.17.0` |
| pnpm version | PASS: `11.7.0` |
| OS/shell | Windows / PowerShell |
| Lockfile | PASS: `pnpm-lock.yaml` exists |
| `.env` / `.env.local` | PASS: absent from workspace scan |
| `.env.example` | PASS: present; contains empty placeholders |
| Deployment files | PASS: `deployments/testnet*.json` present |
| Private key files | PASS: no Stellar secret-key-shaped strings found in scanned source/deployment paths |
| Notable local file | `NUL` exists at repo root; not validated as intentional |

## 2. Clean Install And Workspace Validation

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Already up to date using pnpm 11.7.0. |
| `pnpm typecheck` | PASS | Reran after fixes; all 5 workspace projects passed. |
| `pnpm lint` | PASS WITH DISCLOSURE | This is not a real lint command; package `lint` scripts run `tsc --noEmit`. |
| `pnpm test` | PASS | Reran after fixes. ZK tests 8/8, merkle 5/5, prover 8/8, stellar 3/3; shared/web have no tests and pass with no-test mode. |
| `pnpm build` | PASS | Reran after fixes. Next build prerendered `/`, `/debug`, `/donor`, `/operator`, `/recipient`. |

## 3. ZK Environment Validation

Command: `pnpm zk:doctor`

Status: READY for deterministic development validation.

Evidence:

| Check | Status | Evidence |
| --- | --- | --- |
| Node | PASS | `Node v22.17.0` |
| pnpm | PASS | `pnpm 11.7.0` |
| Circom | PASS | Project-local Circom found: `circom compiler 2.2.3` |
| snarkjs | PASS | `0.7.6` |
| Circuit source | PASS | `circuits/claim/claim.circom` found |
| Build artifacts | PASS | Present after clean build |
| Demo proof artifacts | PASS | Present after proof generation |

Note: setup is deterministic development setup, not a production trusted setup ceremony.

## 4. ZK Clean Build Validation

Commands:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm zk:clean` | PASS | Removed `circuits/claim/build` via safe path check. |
| `pnpm zk:setup` | PASS | Verified project-local Circom binary. |
| `pnpm zk:build` | PASS WITH DISCLOSURE | Real Circom compilation and Groth16 setup ran. Setup is deterministic development-only. |

Build evidence:

- Circom compiled `claim.circom`.
- `snarkjs r1cs info` reported curve `bn-128`, 3,486 constraints, 8 private inputs, 8 public inputs.
- Groth16 setup and verification key export ran.
- Output said: `ZK build completed with real Circom compilation and Groth16 setup.`

Generated artifacts:

| Artifact | Path | Generated now? | Notes |
| --- | --- | --- | --- |
| R1CS | `circuits/claim/build/claim.r1cs` | Yes | Real Circom output |
| Symbol file | `circuits/claim/build/claim.sym` | Yes | Real Circom output |
| Circuit wasm | `circuits/claim/build/claim_js/claim.wasm` | Yes | Real Circom output |
| Witness generator | `circuits/claim/build/claim_js/generate_witness.js` | Yes | Real Circom output |
| PTAU | `circuits/claim/build/pot12_final.ptau` | Yes | Deterministic development PTAU |
| Initial zkey | `circuits/claim/build/claim_0000.zkey` | Yes | Groth16 setup |
| Final zkey | `circuits/claim/build/claim_final.zkey` | Yes | Deterministic development beacon |
| Verification key | `circuits/claim/build/verification_key.json` | Yes | Exported by snarkjs |
| Alice witness | `circuits/claim/build/alice-witness.wtns` | Yes | Generated by proof command; private demo artifact |
| Alice proof | `circuits/claim/build/alice-proof.json` | Yes | Generated by proof command |
| Alice public signals | `circuits/claim/build/alice-public.json` | Yes | Generated by proof command |

## 5. ZK Proof Generation And Verification

Commands:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm zk:prove:demo` | PASS | Generated Alice witness/proof and ran `snarkjs groth16 verify`; `Verifier mode: real_local`. |
| `pnpm zk:verify:local` | PASS | Reran after adding wrong-root case; all cases passed with real Groth16 verification. |
| `pnpm zk:test` | PASS | Reran after validation patch; 8/8 tests passed. |

Case table:

| Case | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- |
| Alice valid proof | Verification succeeds | true | PASS | `snarkjs groth16 verify` returned `OK!` |
| Mallory not eligible | Witness/proof fails | false | PASS | Invalid witness generation failed |
| Over-cap amount | Witness/proof fails | false | PASS | Invalid witness generation failed |
| Tampered public input | Verification fails | false | PASS | Nullifier public signal changed |
| Tampered proof | Verification fails | false | PASS | `pi_a[0]` changed |
| Wrong campaign_id | Verification fails | false | PASS | Campaign public signal changed |
| Wrong policy_hash | Verification fails | false | PASS | Policy public signal changed |
| Wrong eligibility root | Verification fails | false | PASS | Eligibility root public signal changed |

Local verification is real cryptographic verification through snarkjs Groth16. It is not the TypeScript dev verifier.

## 6. ZK Implementation Audit

| Item | Evidence |
| --- | --- |
| Proof system | Groth16 over BN254/bn128 via Circom + snarkjs |
| Circuit file | `circuits/claim/claim.circom` |
| Circuit size | 3,486 constraints, 8 private inputs, 8 public inputs |
| Private inputs | `recipient_secret`, `identity_hash`, `leaf_salt`, `eligibility_merkle_path[2]`, `eligibility_merkle_indices[2]`, `amount_salt` |
| Public inputs | `campaign_id`, `eligibility_root`, `policy_hash`, `nullifier_hash`, `amount`, `max_amount`, `amount_commitment`, `recipient_commitment` |
| Merkle root derivation | Poseidon leaf over recipient secret, identity hash, leaf salt, policy hash; depth-2 Poseidon path with binary indices |
| Nullifier derivation | Poseidon(`recipient_secret`, `campaign_id`) |
| Amount commitment | Poseidon(`amount`, `amount_salt`, `campaign_id`) |
| Recipient commitment | Poseidon(`recipient_secret`, `policy_hash`) |
| Local verifier | `snarkjs groth16 verify` against `verification_key.json`, public signals, proof |
| Soroban verifier | `contracts/verifier/src/groth16_claim_v0.rs` uses Soroban BN254 pairing check by default |
| Proof format | snarkjs JSON locally; testnet helper converts proof to 256-byte hex tuple |
| Public input serialization | `publicSignalsFromInputs` order matches circuit public input order; Soroban helper serializes named fields |
| Browser proving | Not implemented as Groth16; browser uses explicit `dev_verifier` envelope |

Layer table:

| Layer | Status | Evidence |
| --- | --- | --- |
| Circuit source | Real | `claim.circom` exists and constrains Merkle, nullifier, commitments, cap |
| Circuit compilation | Real | `pnpm zk:build` ran Circom and snarkjs |
| Proof generation | Real | `pnpm zk:prove:demo` generated witness/proof |
| Local verification | Real | snarkjs Groth16 verification returned `OK!` |
| Negative cases | Pass | `pnpm zk:verify:local` covered required cases |
| Public input formatting | Verified | Named inputs and public signals checked by scripts/tests |
| Browser proving | Missing for real ZK | Browser uses dev envelope only |

## 7. Soroban Contracts Validation

Commands:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm contracts:build` | PASS | Built verifier, campaign, mock token WASMs after fixes. Campaign emits deprecation warnings for event publishing. |
| `pnpm contracts:test` | PASS | Default real verifier path: verifier 6/6, campaign 10/10, mock token 1/1. |
| `pnpm contracts:test:dev` | PASS WITH DISCLOSURE | Dev verifier feature path: verifier 2/2, campaign 10/10, mock token 1/1. |

Campaign behavior validated:

- Initialization works.
- Operator auth checks for root updates work.
- Valid claim succeeds.
- Same nullifier is rejected.
- Wrong campaign ID is rejected after fix.
- Wrong eligibility root is rejected.
- Wrong policy hash is rejected.
- Amount over cap is rejected.
- Claim after close is rejected.
- Stats update after valid claim.
- Claim totals do not update after rejected claims; invalid/duplicate counters update.
- Nullifier is stored only after successful verifier acceptance.
- Nullifier is not stored after failed claims.

Verifier behavior:

| Verifier mode | Status | Evidence |
| --- | --- | --- |
| Default build | Real cryptographic verifier | `contracts:test` accepts Alice Groth16 proof and rejects invalid/tampered/malformed/dev proofs |
| `dev_verifier` feature | Dev-only verifier | Explicit feature accepts deterministic test digest; not enabled in default `contracts:test` or default WASM build |

Contract table:

| Contract | Status | Tests run | Notes |
| --- | --- | --- | --- |
| `lumen_verifier` | PASS WITH DISCLOSURE | 6 default, 2 dev-feature | Real BN254 Groth16 by default; dev verifier is feature-gated |
| `lumen_campaign` | PASS | 10 default, 10 dev-feature | Includes campaign ID/root/policy/cap/nullifier checks |
| `lumen_mock_token` | PASS WITH DISCLOSURE | 1 | Demo helper only |

## 8. Unsafe Verifier Behavior Audit

Search terms included: `return true`, `mock`, `stub`, `fake`, `dev_verifier`, `DevVerifier`, `TODO`, `FIXME`, `bypass`, `demo-only`, `test-only`, `hardcoded`, `accepts all`.

| File | Area | Finding | Risk | Action |
| --- | --- | --- | --- | --- |
| `contracts/campaign/src/lib.rs` | Campaign claim flow | Missing campaign ID check before fix | High: alternate campaign ID could undermine nullifier binding | Fixed with `WrongCampaignId` check and regression test |
| `packages/stellar/src/index.ts` | Local simulator | Missing campaign ID and max amount checks before fix | Medium: simulator could accept claims contract would reject | Fixed simulator parity and tests |
| `contracts/verifier/src/lib.rs` | Dev verifier | `dev_verifier` feature accepts deterministic 32-byte digest | Medium if enabled accidentally | Feature-gated; default tests prove dev proof rejected without feature |
| `packages/prover/src/index.ts` | Browser proof envelope | TypeScript prover supports only explicit `mode: "dev_verifier"` | Disclosure risk | UI/docs label browser path as dev-only |
| `scripts/demo-e2e.ts` | Demo output | Previously overclaimed on-chain verification inside local demo command | Disclosure risk | Fixed wording; reran `demo:e2e` |
| `contracts/verifier/src/groth16_claim_v0.rs` | `return true` matches | Found only in byte comparison helper functions | Low | No action |
| `apps/web/app/recipient/recipient-client.tsx` | Private witness display | Normal recipient page hides private values until synthetic demo reveal | Low | PASS; debug page separately warns |

## 9. Full Deterministic Demo Validation

Command: `pnpm demo:e2e`

Status: PASS WITH DISCLOSURE

The command proves the local cryptographic ZK path and exercises a local Soroban-shaped simulator with dev-verifier envelope. It does not exercise on-chain verification.

| Scenario | Expected | Actual | Status |
| --- | --- | --- | --- |
| Campaign setup | Compiled circuit and deterministic campaign | Passed | PASS |
| Alice valid claim | Proof generated, local verification passes, claim accepted | Passed | PASS |
| Alice duplicate | Same nullifier rejected | Passed | PASS |
| Mallory | Rejected | Passed | PASS |
| Over-cap | Rejected | Passed | PASS |
| Wrong root | Rejected | Passed | PASS |
| Wrong policy | Rejected | Passed | PASS |
| Final stats | 1 accepted, 1 duplicate blocked, 4 invalid blocked | Passed | PASS |
| Verifier disclosure | Must identify simulator/dev envelope | Output now warns on-chain verification is not exercised | PASS WITH DISCLOSURE |

## 10. Frontend Functionality Validation

Commands:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm --filter @lumen-aid/web build` | PASS | Prerendered `/`, `/debug`, `/donor`, `/operator`, `/recipient`. |
| `pnpm --filter @lumen-aid/web test` | PASS WITH DISCLOSURE | No frontend test files; passes via `--passWithNoTests`. |
| Browser smoke on `next start --port 3001` | PASS | Production build route and recipient interaction smoke passed. |

Browser notes:

- Browser plugin was available and used.
- Existing port 3000 was already running before validation. Static pages rendered there, but early click attempts were inconclusive/inert in the browser automation session.
- A fresh production `next start --port 3001` was started from the built app, validated, and stopped.
- Production smoke exercised Generate proof -> Submit claim -> Try duplicate on `/recipient`; no console errors/warnings were reported.

Page table:

| Page | Status | Notes |
| --- | --- | --- |
| `/` | PASS | Rendered Lumen overview, campaign metrics, dev verifier status disclosure |
| `/operator` | PASS | Rendered campaign creation/config UI; no route crash |
| `/recipient` | PASS WITH DISCLOSURE | Browser flow uses dev verifier envelope; production smoke proved proof state, accepted claim, duplicate rejection |
| `/donor` | PASS WITH DISCLOSURE | Reads local browser demo state; labels verifier as dev-only |
| `/debug` | PASS WITH DISCLOSURE | Shows explicit warning before exposing synthetic fixture private data |

Privacy/UI observations:

- Normal recipient page hides private values by default.
- Debug page warning is visible.
- Browser/donor UI does not claim browser-submitted production ZK.
- Verifier status is labeled as dev-only in browser flows.

## 11. Stellar Testnet Validation

Command: `pnpm stellar:doctor`

Status: BLOCKED

Tooling evidence:

| Testnet item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Stellar CLI | PASS | `stellar 25.1.0` | Available |
| Rust | PASS | `rustc 1.92.0` | Available |
| Cargo | PASS | `cargo 1.92.0` | Available |
| wasm target | PASS | `wasm32v1-none target installed` | Available |
| Testnet CLI config | PASS | `stellar CLI testnet network configured` | Available |
| `STELLAR_NETWORK=testnet` | BLOCKED | Missing env | Required by doctor |
| `STELLAR_SOURCE_ACCOUNT` | BLOCKED | Missing env | Required funded local Stellar CLI key name |
| Deployment metadata | PASS | `deployments/testnet.json` and `deployments/testnet-campaign.json` exist | Public IDs only; no secret key found |
| Testnet read validation | BLOCKED | No read-only script found and source account missing | Not freshly validated |
| Alice claim smoke | BLOCKED | `pnpm stellar:claim:alice:testnet` exists but requires source account | Not run |
| Alice duplicate smoke | BLOCKED | `pnpm stellar:claim:alice-duplicate:testnet` exists but requires source account | Not run |

Deployment files inspected:

- `deployments/testnet.json`: network `testnet`, campaign/verifier/mock token contract IDs present, deployer public key present, notes say verifier build used default real Groth16 path.
- `deployments/testnet-campaign.json`: network `testnet`, deterministic campaign config present, mode `real_groth16_verifier`.
- `deployments/testnet-alice-claim.json`: historical local artifact says accepted at `2026-07-01T16:27:44.412Z`.
- `deployments/testnet-alice-duplicate-claim.json`: historical local artifact says duplicate rejected at `2026-07-01T16:27:59.653Z`.

These historical files are not fresh testnet validation from this run.

## 12. Privacy And Secret Leakage Validation

Searches run:

- File/env scan: `.env*`
- Secret/key text scan: `SECRET`, `PRIVATE_KEY`, `SEED`, `SKEY`, `operatorSecret`, `recipient_secret`, `identity_hash`, `witness`, `.env`
- Stellar secret key pattern: `S[A-Z2-7]{55}`
- Generic API key patterns: AWS, Slack, Stripe, Google API examples

| Finding | File | Severity | Action |
| --- | --- | --- | --- |
| `.env.example` contains empty secret placeholders | `.env.example` | Low | Acceptable; no values present |
| No `.env` or `.env.local` found | Workspace scan | Pass | No action |
| No Stellar secret-key-shaped values found | Source/deployment scan | Pass | No action |
| No generic API key patterns found | Source/deployment scan | Pass | No action |
| Demo recipient secrets exist in fixtures | `packages/shared/src/demo/recipients.ts` | Low | Acceptable deterministic demo fixtures |
| Private witness/debug artifacts generated | `circuits/claim/build/*input*.json`, `alice-witness.wtns`, `alice-private-inputs.debug.json` | Medium if packaged | Directory is ignored by `.gitignore`; do not ship generated private artifacts in release bundles |
| Normal recipient UI hides private values | `/recipient` browser smoke and source | Pass | No action |
| Debug route exposes synthetic witness with warning | `/debug` source/browser route | Low | Acceptable with warning |

## 13. Reproducibility Check

README command table:

| README command | Exists? | Ran? | Status | Notes |
| --- | --- | --- | --- | --- |
| `pnpm install` | Yes | `pnpm install --frozen-lockfile` | PASS | Frozen install used for RC validation |
| `pnpm dev` | Yes | Partial | PARTIAL | Existing dev server on port 3000 was already running; production smoke used `next start --port 3001` |
| `pnpm zk:doctor` | Yes | Yes | PASS | Passed after artifacts present |
| `pnpm zk:setup` | Yes | Yes | PASS | Verified local Circom |
| `pnpm zk:clean` | Yes | Yes | PASS | Cleaned build artifacts |
| `pnpm zk:build` | Yes | Yes | PASS WITH DISCLOSURE | Deterministic development setup |
| `pnpm zk:prove:demo` | Yes | Yes | PASS | Real snarkjs proof |
| `pnpm zk:verify:local` | Yes | Yes | PASS | Real snarkjs verification and negatives |
| `pnpm demo:e2e` | Yes | Yes | PASS WITH DISCLOSURE | Local simulator/dev envelope |
| `pnpm test` | Yes | Yes | PASS | Full package test suite passed |
| `pnpm contracts:test` | Yes | Yes | PASS | Default real verifier path |
| `pnpm build` | Yes | Yes | PASS | Workspace build passed |
| `pnpm stellar:doctor` | Yes | Yes | BLOCKED | Missing `STELLAR_NETWORK=testnet` and `STELLAR_SOURCE_ACCOUNT` |
| `pnpm contracts:build` | Yes | Yes | PASS | Built WASMs |
| `pnpm stellar:deploy:testnet` | Yes | No | BLOCKED | Requires source account; deployment flow intentionally not run |
| `pnpm stellar:init-campaign:testnet` | Yes | No | BLOCKED | Requires source account; state-changing |
| `pnpm stellar:claim:alice:testnet` | Yes | No | BLOCKED | Requires source account; state-changing |
| `pnpm stellar:claim:alice-duplicate:testnet` | Yes | No | BLOCKED | Requires source account; state-changing |

## 14. Final Full Validation Table

| Area | Status | Evidence | Risk | Decision |
| --- | --- | --- | --- | --- |
| Clean install | PASS | `pnpm install --frozen-lockfile` | Low | SHIP |
| Typecheck | PASS | `pnpm typecheck` | Low | SHIP |
| Lint | PASS WITH DISCLOSURE | `pnpm lint` is `tsc --noEmit` alias | No stylistic lint coverage | SHIP WITH DISCLOSURE |
| Unit/package tests | PASS | `pnpm test` | Packages with no tests pass by no-test mode | SHIP |
| Frontend build | PASS | `pnpm build`, web build | Low | SHIP |
| ZK doctor | PASS | `pnpm zk:doctor` | Low | SHIP |
| ZK clean/setup/build | PASS WITH DISCLOSURE | Real compile; deterministic dev setup | Production setup not done | SHIP WITH DISCLOSURE |
| ZK proof generation | PASS | `pnpm zk:prove:demo` | Low for demo | SHIP |
| ZK local verification | PASS | `pnpm zk:verify:local` | Low | SHIP |
| ZK negative cases | PASS | Required cases covered | Low | SHIP |
| Soroban contract build | PASS | `pnpm contracts:build` | Event deprecation warnings | SHIP |
| Soroban contract tests | PASS | `pnpm contracts:test` | Low | SHIP |
| Verifier contract | PASS WITH DISCLOSURE | Real default, dev feature explicit | Dev feature must not ship accidentally | SHIP WITH DISCLOSURE |
| Campaign claim flow | PASS | 10 campaign tests | Low after campaign ID fix | SHIP |
| Nullifier double-claim prevention | PASS | Contract/demo tests | Low after campaign ID fix | SHIP |
| `demo:e2e` | PASS WITH DISCLOSURE | Local simulator/dev envelope disclosed | Not on-chain | SHIP WITH DISCLOSURE |
| Testnet doctor | BLOCKED | Missing env/source account | Cannot validate fresh testnet | MUST FIX |
| Testnet read validation | BLOCKED | No read-only script and missing source account | Cannot confirm deployed state now | MUST FIX |
| Testnet claim smoke test | BLOCKED | Claim scripts not run due missing source account | Cannot claim fresh testnet smoke | MUST FIX |
| Frontend route validation | PASS | Build plus browser smoke on production `next start` | Existing dev server interaction was inconclusive | SHIP |
| Mock/dev-only audit | PASS WITH DISCLOSURE | Dev verifier feature and browser envelope explicit | Disclosure required | SHIP WITH DISCLOSURE |
| Privacy leakage audit | PASS WITH DISCLOSURE | Normal UI hides private data; debug warns; build artifacts contain demo witness | Do not ship generated witness artifacts | SHIP WITH DISCLOSURE |
| Secret leakage audit | PASS | No secret key/API key patterns found | No Git metadata to prove committed state | SHIP |
| README command accuracy | PARTIAL | Commands exist; testnet commands blocked by env | Reviewer cannot run testnet without env | MUST FIX |

## 15. Final Truth Table

## What is real

- Circom circuit compilation.
- Groth16 trusted setup generation for deterministic development artifacts.
- snarkjs witness/proof generation for Alice.
- snarkjs local Groth16 verification.
- Required ZK negative cases.
- Soroban verifier default BN254 Groth16 path in local contract tests.
- Soroban campaign contract local tests for claim, rejection, stats, nullifier behavior.
- Frontend production build.
- Production frontend route smoke and recipient Generate -> Submit -> Duplicate interaction on local `next start`.

## What is dev-only

- Deterministic development trusted setup artifacts.
- `@lumen-aid/prover` browser proof envelope (`mode: "dev_verifier"`).
- `contracts/verifier --features dev_verifier`.
- Browser recipient/donor/debug proof/claim path.
- `contracts/mock_token` demo helper.

## What is simulated

- `packages/stellar/src/index.ts` local Soroban-shaped client.
- `pnpm demo:e2e` campaign claim submission path.
- Browser campaign state and event stream.

## What is testnet-validated

- Fresh validation: tooling only through `stellar:doctor` until env checks.
- Public deployment metadata exists and was inspected.
- Historical local evidence files say Alice accepted and duplicate rejected on testnet on 2026-07-01 around 16:27 UTC, but those were not freshly rerun.

## What is blocked

- Git cleanliness/branch/tracked-file status: no `.git`.
- Fresh Stellar testnet doctor: missing `STELLAR_NETWORK=testnet` and `STELLAR_SOURCE_ACCOUNT`.
- Fresh testnet read validation: no read-only script found and source account missing.
- Fresh Alice claim and duplicate smoke: source account missing and state-changing scripts were not run.
- Exact `pnpm dev` start: existing port 3000 dev server already running.

## What we must not claim

- Do not claim fresh testnet smoke passed in this validation run.
- Do not claim browser-submitted production ZK claims.
- Do not claim the browser demo uses real Groth16 proving.
- Do not claim production trusted setup ceremony is complete.
- Do not claim the repo is Git-clean or reproducible from Git metadata in this workspace.
- Do not claim no generated private witness artifacts exist in the workspace.
- Do not claim frontend has automated tests beyond build and browser smoke.

## Must-fix before continuing product polish

1. Provide `STELLAR_NETWORK=testnet` and a funded `STELLAR_SOURCE_ACCOUNT` local key name, then rerun `pnpm stellar:doctor`.
2. Rerun fresh testnet read/claim validation with existing scripts, or add a minimal read-only script if fresh read validation is required.
3. Confirm this is a real Git worktree before release review; capture branch and clean/dirty status.
4. Ensure generated `circuits/claim/build` witness/private input artifacts are not included in release bundles.
5. Keep all browser/demo claims labeled as dev verifier until browser real proving/testnet submission is wired.

## Nice-to-have after core validation

1. Add a real lint tool or rename current `lint` alias to avoid overclaiming lint coverage.
2. Add frontend automated tests for recipient Generate/Submit/Duplicate.
3. Add read-only testnet scripts for campaign/config/stats/verifier status.
4. Replace deprecated Soroban event publishing with `#[contractevent]`.
5. Remove or justify the root `NUL` file.
6. Add a production trusted setup ceremony path before production claims.
7. Add generated-verifier-constant tooling from verification keys.

## Final Recommendation

Fix must-fix issues first.

The local product is much stronger after the fixes, but the release candidate is not fully validated end-to-end because fresh testnet validation is blocked and Git repository state is unavailable.
