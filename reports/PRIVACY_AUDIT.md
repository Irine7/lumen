# Lumen Privacy Audit

Date: 2026-07-03T12:49:50.549Z

| Check | Status | Evidence |
| --- | --- | --- |
| API route rejects private witness fields | PASS | Relayer route recursively scans request keys for private witness names before processing. |
| Claim network request contains only public payout data | PASS | Recipient POST body contains proof encoding, public inputs, public payout recipient, campaign contract ID, and campaign ID. |
| Compliance private witness fields are blocked | PASS | The relayer rejects compliance witness fields and refuses stale active deployments that lack a public compliance root. |
| Browser computes payout binding locally | PASS | The worker derives payout_account_hash before witness generation, and the UI computes the same public hash from the selected payout address. |
| Payout address is public and allowed | PASS | The relayer accepts the public payout recipient while still rejecting witness/private fields. |
| Relayer rejects swapped payout recipient | PASS | The relayer recomputes payout_account_hash from payoutRecipient and rejects mismatches before sending a transaction. |
| Relayer cannot change amount/campaign/root/policy | PASS | The relayer serializes caller-supplied public inputs without private data, pins the active campaign ID/contract, and simulates before submission. |
| Browser normal mode does not log private witness values | PASS | Browser proof worker and recipient UI do not console-log witness/private field names in normal mode. |
| Relayer rejects mainnet | PASS | Relayer requires STELLAR_NETWORK=testnet and returns 403 otherwise. |
| Relayer rejects unknown campaign ID | PASS | Request campaign ID must match deployments/active-testnet.json. |
| Relayer rejects unknown contract ID | PASS | Request campaign contract ID must match deployments/active-testnet.json. |
| Relayer rejects malformed proof/public inputs | PASS | Proof encoding, hex32 public inputs, and integer amounts are validated before simulation. |
| Relayer does not expose source account secret | PASS | Secret-key shaped STELLAR_SOURCE_ACCOUNT values are refused. |
| .gitignore protects generated witness/private artifacts | PASS | .gitignore covers env files, witness files, private input JSON, circuit build output, and browser ZK artifacts. |
| Contract cannot redirect payout | PASS | Campaign claim computes the Soroban payout recipient hash and compares it with the proof public input. |
| Failed or duplicate claim cannot transfer asset | PASS | Campaign checks payout binding and duplicate nullifier before verifier call, transfers only after verifier success, then stores the nullifier. |
| Debug reveal has warning and explicit toggle | PASS | Private demo values appear only in Debug mode behind an explicit reveal toggle. |

## Result

PASS WITH DISCLOSURE. The browser proof flow keeps eligibility and compliance witness values local, treats the payout address as public, and prevents relayer payout redirection. The deterministic development trusted setup, demo compliance roots, local demo simulator, local testnet relayer, lack of production audit, lack of real KYC/sanctions provider integration, and lack of mainnet support remain disclosures.
