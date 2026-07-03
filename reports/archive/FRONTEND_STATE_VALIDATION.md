# Lumen Frontend State Validation

Date: 2026-07-01

| Page | Mode | Status | Notes |
| --- | --- | --- | --- |
| Landing `/` | Local demo only | PASS | Shows a public status badge derived from `NEXT_PUBLIC_*` env config. With no testnet env, badge is `Local demo only`. |
| Landing `/` | Testnet configured | PASS WITH DISCLOSURE | Badge can show `Testnet connected` when public RPC and contract IDs are configured; donor page performs actual RPC reads. |
| Donor `/donor` | Demo state | PASS | Existing local browser demo metrics remain available and resettable. Browser claims remain demo/local. |
| Donor `/donor` | Testnet state | PASS | Added mode toggle and read-only testnet metrics for contract ID, campaign ID, budget, total claimed, claim count, duplicate/invalid counters, and verifier callable status. |
| Donor `/donor` | Missing testnet env | PASS | `getCampaignConfig()`, `getCampaignStats()`, and `getVerifierStatus()` return `not_configured`; UI shows the error state and does not fall back to mock values. |
| Donor `/donor` | Testnet read failure | PASS | Read failures surface as error state; no silent mock fallback. |
| Recipient `/recipient` | Browser claim path | PASS WITH DISCLOSURE | No browser Groth16 proving or testnet submission was added; browser claims remain demo/local. |

## Config

Frontend reads only public variables:

```txt
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID=
NEXT_PUBLIC_VERIFIER_CONTRACT_ID=
```

No private key or secret key is required by the browser read client.

## Runtime Probe

The new read client was probed against current testnet contracts:

| Function | Status | Evidence |
| --- | --- | --- |
| `getCampaignConfig()` | PASS | Returned campaign ID `0x0026...300101`, budget `1000`, verifier contract ID `CCHDSG4...RR7D`. |
| `getCampaignStats()` | PASS | Returned total claimed `300`, claim count `2`, remaining budget `700`, duplicate/invalid counters `0`. |
| `getVerifierStatus()` | PASS WITH DISCLOSURE | Verifier `verify_claim` callable through simulation; malformed proof returned `false`. Browser read does not attest verifier build mode. |

## Validation

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm typecheck` | PASS | All workspace typechecks passed. |
| `pnpm --filter @lumen-aid/web build` | PASS | Next build completed and prerendered `/`, `/debug`, `/donor`, `/operator`, `/recipient`. |
| `pnpm build` | PASS | Full workspace build passed. |
| Dev server HTTP smoke | PASS | Started `@lumen-aid/web` on `http://localhost:3000` with public testnet env. `/` returned 200 and included `Testnet connected`; `/donor` returned 200 and included `Testnet state`. |
