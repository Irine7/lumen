# Lumen Privacy Audit

Date: 2026-07-02T11:26:37.018Z

| Check | Status | Evidence |
| --- | --- | --- |
| API route rejects private witness fields | PASS | Relayer route recursively scans request keys for private witness names before processing. |
| Claim network request contains only public data | PASS | Recipient POST body is limited to proof encoding, public inputs, campaign contract ID, and campaign ID. |
| Browser normal mode does not log private witness values | PASS | Browser proof worker and recipient UI do not console-log witness/private field names in normal mode. |
| Relayer rejects mainnet | PASS | Relayer requires STELLAR_NETWORK=testnet and returns 403 otherwise. |
| Relayer rejects unknown campaign ID | PASS | Request campaign ID must match deployments/active-testnet.json. |
| Relayer rejects unknown contract ID | PASS | Request campaign contract ID must match deployments/active-testnet.json. |
| Relayer rejects malformed proof/public inputs | PASS | Proof encoding, hex32 public inputs, and integer amounts are validated before simulation. |
| Relayer does not expose source account secret | PASS | Secret-key shaped STELLAR_SOURCE_ACCOUNT values are refused. |
| .gitignore protects generated witness/private artifacts | PASS | .gitignore covers env files, witness files, private input JSON, circuit build output, and browser ZK artifacts. |
| Debug reveal has warning and explicit toggle | PASS | Private demo values appear only in Debug mode behind an explicit reveal toggle. |

## Result

PASS WITH DISCLOSURE. The browser proof flow keeps witness values local and the relayer accepts only proof/public input payloads. The deterministic development trusted setup and mock token remain disclosures.
