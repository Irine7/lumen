# UI Polish For Video

Date: 2026-07-03

## Summary

The old debug-dashboard visual layer was still present on `main` in the shared web shell and UI primitives. The premium UI work was restored manually on top of the current AIDUSD/compliance testnet code instead of applying the stale stash wholesale.

Protocol behavior was not changed:

- Claim circuit unchanged.
- Contracts unchanged.
- Verifier/campaign logic unchanged.
- Relayer claim security logic unchanged.
- No claim submission or campaign creation commands were run.

## Visual Changes Made

- Rebuilt the app shell with `public/logo.png`, product name, subline, polished navigation, and global status strip.
- Added a refined dark product design system: soft background gradients, glass panels, rounded controls, status pills, metric cards, info cards, disclosure banners, collapsible technical details, and empty states.
- Added formatting helpers for shortened public IDs and AIDUSD amounts.
- Moved raw hashes and deployment IDs out of primary views and into collapsible technical sections.
- Replaced debug copy such as `unread`, `none`, `not submitted`, and `not run` with human pending states.
- Added `logo.png` as the app icon metadata.

## Pages Updated

- `/`: Human landing page with “Private aid payouts. Public accountability.”, four product cards, flow diagram, CTA, and collapsed deployment details.
- `/demo`: Product-style command center with visible `Campaign state: pristine`, `Verifier mode: real_groth16`, escrow metrics, checklist, action cards, and deployment details collapsed.
- `/donor`: Accountability dashboard with clean AIDUSD metrics, refresh button, live-read warning state, latest local claim empty state, and public campaign data collapsed.
- `/recipient`: Guided claim hero, five-step flow, privacy note, cleaner pending states, preserved proof/submit controls and e2e selectors, public payload collapsed.
- `/auditor`: Polished empty state, explicit demo-only warning, separate “Load local package” and “Load preview package”, clean public/auditor views.
- `/operator`: Campaign status/setup screen focused on active deployment, escrow/verifier readiness, and collapsed local simulator controls.
- `/debug`: Strong debug warning and isolated debug styling.

## State-Read Fixes Made

- `/api/testnet/state` now carries `verifierMode` from `deployments/active-testnet.json` when optional live verifier reads are unavailable.
- Metadata-only/error states no longer surface raw `unread`; they show `Live read unavailable` with a reason.
- `/demo` and `/donor` prefer server-side active deployment state and do not show `Missing NEXT_PUBLIC_RPC_URL` when the server can read active metadata.
- `/demo` exposes the searchable visible strings:
  - `Campaign state: pristine`
  - `Verifier mode: real_groth16`

## Render QA

Production render checked on temporary `next start --port 3002`.

- `/demo`: contained `Campaign state: pristine`, `Verifier mode: real_groth16`, `AIDUSD`; no `unread`; no `Missing NEXT_PUBLIC_RPC_URL`; no console warnings/errors.
- `/donor`: showed `Escrow funded: 1,000 AIDUSD`, `Total distributed: 0 AIDUSD`, `Remaining budget: 1,000 AIDUSD`, `Claim count: 0`, `Verifier mode: real_groth16`; no console warnings/errors.
- `/recipient`: rendered guided claim flow and `Generate real browser Groth16 proof`; no console warnings/errors.
- `/auditor`: rendered polished empty state and demo-only disclosure; no console warnings/errors.
- `/operator` and `/debug`: rendered expected page titles and warnings; no console warnings/errors.
- Viewports checked: 1440x900 desktop and 390x844 mobile-ish.

Screenshot evidence saved outside the repo:

- `C:\Users\TEKNES\AppData\Local\Temp\lumen-ui-polish-qa\demo-1440.png`
- `C:\Users\TEKNES\AppData\Local\Temp\lumen-ui-polish-qa\donor-1440.png`
- `C:\Users\TEKNES\AppData\Local\Temp\lumen-ui-polish-qa\recipient-1440.png`
- `C:\Users\TEKNES\AppData\Local\Temp\lumen-ui-polish-qa\auditor-1440.png`
- `C:\Users\TEKNES\AppData\Local\Temp\lumen-ui-polish-qa\demo-390.png`

## Validation Commands Run

- `pnpm --filter @lumen-aid/web typecheck` - passed.
- `pnpm --filter @lumen-aid/web build` - passed.
- `pnpm typecheck` - passed.
- `pnpm build` - passed.
- `pnpm privacy:audit` - passed.
- `pnpm stellar:aidusd:active:testnet` - passed; readonly `--send no` invocations only.

Readonly active testnet evidence:

- Asset mode: `aidusd_sac`
- Asset code: `AIDUSD`
- Campaign contract: `CD6BWJYNDJPSK4LDKICLSV4IDN7XXHNE3BYA4V7KYMPA4SNAYBQ4UFE4`
- Verifier contract: `CCRODRGI5YO73MBYDN2ITFQETE2I6V3NVX7S7YVXTZQ4XJ3UOUY4SUGI`
- Escrow funded: `1000`
- Escrow balance: `1000`
- Dora read-only balance check completed with `--send no`; no Dora claim was submitted.

## Commands Not Run

No state-changing validation, claim, or campaign creation commands were run.

Specifically not run:

- `pnpm judge:validate:testnet`
- `pnpm web:e2e:compliance:testnet`
- `pnpm stellar:smoke:aidusd:testnet`
- `pnpm stellar:smoke:compliance:testnet`
- Any command that submits a claim or consumes Dora.
- Any command that creates a new campaign.

## Known Remaining UI Limitations

- Mobile navigation is horizontally scrollable to preserve all existing routes in the top shell.
- The UI remains a testnet prototype and keeps disclosures visible.
- The auditor preview package is clearly labeled preview-only until a live local claim package exists in the browser.
- Technical details are available behind collapsible sections; they are intentionally not optimized for first-frame video readability.
