# Pre-Recording UI Fix

Date: 2026-07-03

## Root Cause

The testnet pages did not share one read source.

`/demo` and `/donor` loaded active deployment metadata from the server, then attempted live campaign reads from browser-side helpers built from `NEXT_PUBLIC_*` env. When `NEXT_PUBLIC_RPC_URL` was not exposed, the browser read path reported missing configuration even though the server and CLI could read `deployments/active-testnet.json` and the live AIDUSD campaign.

`/demo` also treated failed stats/escrow reads as unexplained `unread` values. `/donor` mixed active metadata, local demo fallback language, and per-page live reads. `/operator` showed active metadata but not the shared live state. `/recipient` had working proof logic but video-unfriendly labels. `/auditor` showed repeated placeholder values before a package was loaded.

## Files Changed

- `apps/web/app/api/testnet/state/route.ts`
- `apps/web/lib/active-testnet-state.ts`
- `apps/web/app/demo/demo-client.tsx`
- `apps/web/app/donor/donor-client.tsx`
- `apps/web/app/operator/operator-client.tsx`
- `apps/web/app/recipient/recipient-client.tsx`
- `apps/web/app/auditor/auditor-client.tsx`
- `apps/web/app/api/testnet/config/route.ts`
- `apps/web/lib/testnet-active.ts`
- `apps/web/lib/testnet-state.ts`

Validation also refreshed generated artifacts:

- `apps/web/next-env.d.ts`
- `reports/PRIVACY_AUDIT.md`

## Validation

Passed:

- `pnpm typecheck`
- `pnpm --filter @lumen-aid/web build`
- `pnpm build`
- `pnpm stellar:aidusd:active:testnet`
- `pnpm privacy:audit`

`pnpm web:smoke:readonly` is not defined in `package.json`, so no new smoke infrastructure was added.

Manual browser smoke was run against `http://127.0.0.1:3001` with production `next start`:

- `/demo`: page identity ok, no visible framework error, no console warnings/errors, `Refresh state` re-read the endpoint, live state stayed ready.
- `/donor`: page identity ok, no visible framework error, no console warnings/errors, live AIDUSD values rendered.
- `/operator`: page identity ok, no visible framework error, no console warnings/errors, active AIDUSD campaign details rendered.
- `/recipient`: page identity ok, no visible framework error, no console warnings/errors, submit was disabled before proof generation.
- `/auditor`: page identity ok, no visible framework error, no console warnings/errors, empty state rendered and `Load local package` loaded a clearly labeled preview package.

## Final Page State

`/demo`:

- Active AIDUSD testnet deployment configured.
- Asset: AIDUSD.
- Verifier mode: `real_groth16`.
- Campaign state: `pristine`.
- Claim count: `0`.
- Total claimed: `0`.
- Remaining budget: `1000`.
- Remaining escrow: `1000`.
- Status: Ready for full demo sequence.

`/donor`:

- Testnet state configured.
- Configured budget: `1000`.
- AIDUSD escrow funded: `1000`.
- Total distributed: `0`.
- Remaining budget: `1000`.
- Actual token / escrow balance: `1000`.
- Claim count: `0`.
- Verifier mode: `real_groth16`.

`/recipient`:

- Selected: Dora.
- Dora is shown as eligible + compliant and ready for valid claim.
- Proof status before proof: `idle`.
- Local verification before proof: `pending`.
- Submit is disabled until local verification passes.
- Public claim payload fields show `will be generated after proof`.
- Proof generation and submission logic were not changed.

`/auditor`:

- Before package load: `No disclosure package loaded yet.`
- Demo-only selective disclosure warning remains visible.
- Text area explains what to paste or load.
- `Load local package` loads the latest browser package if present, otherwise a clearly labeled preview package.
- `Verify package` reports package presence, audit commitment presence, proof verification, and preview/claim package type.

## Safety Confirmation

No state-changing testnet commands were run.

Not run:

- `pnpm judge:validate:testnet`
- `pnpm web:e2e:compliance:testnet`
- `pnpm stellar:smoke:aidusd:testnet`
- `pnpm stellar:smoke:compliance:testnet`
- Any command that submits a claim or consumes Dora.

Dora was not claimed or consumed during this task.

The implementation does not change circuits, contracts, verifier logic, campaign logic, or production readiness claims.
