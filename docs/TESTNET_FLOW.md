# Testnet Flow

## Real Now

The product supports this full active testnet path:

```txt
browser real Groth16 proof
-> browser local verification
-> browser submits proof/public inputs to the testnet relayer
-> Soroban verifier/campaign accepts or rejects claim
-> donor dashboard refreshes live testnet state
```

Commands:

```bash
pnpm web:zk:prepare
pnpm stellar:fresh-campaign:testnet
pnpm stellar:active:testnet
pnpm stellar:smoke:testnet:full
pnpm web:e2e:testnet
pnpm privacy:audit
```

## Active Deployment

`pnpm stellar:fresh-campaign:testnet` writes public active deployment data to:

```txt
deployments/active-testnet.json
```

The file contains contract IDs, campaign ID, eligibility root, policy hash, budget, cap, verifier info, and public recipient labels only. It does not contain recipient secrets, witness data, Merkle paths, private input JSON, or key material.

## Browser Claim

Real Testnet Claim mode:

- loads the active campaign through `/api/testnet/config`,
- builds the recipient witness locally in a Web Worker,
- uses `/zk/claim.wasm`, `/zk/claim_final.zkey`, and `/zk/verification_key.json`,
- verifies the Groth16 proof locally in the browser,
- sends only `proofEncodingForSoroban`, `publicInputs`, `campaignContractId`, and `campaignId` to `/api/testnet/claim`.

The relayer is disabled unless:

```txt
LUMEN_TESTNET_RELAYER_ENABLED=true
STELLAR_NETWORK=testnet
STELLAR_SOURCE_ACCOUNT=<local Stellar CLI key name>
```

It rejects mainnet, unknown active campaign IDs, unknown campaign contract IDs, malformed proof/public input payloads, private witness field names, and secret-key-shaped `STELLAR_SOURCE_ACCOUNT` values.

## Donor Dashboard

The donor dashboard reads the active testnet campaign and shows:

- campaign contract ID,
- verifier contract ID,
- mock token contract ID,
- campaign ID,
- eligibility root,
- policy hash,
- budget,
- total claimed,
- remaining budget,
- claim count,
- duplicate and invalid counters,
- verifier mode from `verifier_info()` when available,
- last browser tx hash from this browser session.

If an old deployed verifier lacks `verifier_info()`, the UI shows:

```txt
Verifier mode: legacy verifier, mode not introspectable
```

## Disclosure-Only

- Trusted setup is deterministic development-only.
- Mock token remains a demo asset.
- Local Demo mode uses a simulator/dev verifier envelope.
- `dev_verifier` is a feature/test path, not production ZK.
- Freighter wallet mode is not implemented.
- Production audit is not done.
- Mainnet is not supported.

