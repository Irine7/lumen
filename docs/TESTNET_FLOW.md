# Testnet Flow

## Real Now

The current compliance-aware product path is:

```txt
browser real Groth16 proof
-> private eligibility + demo compliance clearance membership
-> proof bound to payout recipient
-> browser local verification
-> browser submits proof/public inputs + payout recipient to the testnet relayer
-> relayer and campaign check payout_account_hash
-> campaign checks eligibility_root, compliance_root, policy_hash, cap, and nullifier
-> Soroban verifier/campaign accepts or rejects claim
-> campaign transfers testnet SAC escrow value after proof success
-> donor dashboard refreshes aggregate state, balances, tx hash, and audit commitment availability
```

The preferred asset path is AIDUSD testnet SAC. The preserved fallback is native testnet XLM SAC. The current active AIDUSD compliance deployment is validated; fresh deployments still require a funded local Stellar CLI source key name in `STELLAR_SOURCE_ACCOUNT`.

Commands:

```bash
pnpm web:zk:prepare
pnpm zk:verify:compliance
pnpm contracts:test:compliance
pnpm stellar:asset:doctor:testnet
pnpm stellar:asset:setup-aidusd:testnet
pnpm stellar:fresh-aidusd-campaign:testnet
pnpm stellar:aidusd:active:testnet
pnpm stellar:smoke:aidusd:testnet
pnpm stellar:smoke:compliance:testnet
pnpm web:e2e:compliance:testnet
pnpm privacy:audit
```

## Active Deployment

`pnpm stellar:fresh-aidusd-campaign:testnet` should write public active AIDUSD deployment data to:

```txt
deployments/active-testnet.json
```

The file should contain contract IDs, asset mode, asset code, asset issuer, asset contract ID, campaign ID, eligibility root, compliance root, policy hash, budget, funded escrow amount, cap, verifier info, and public recipient payout addresses only. It must not contain recipient secrets, witness data, Merkle paths, private input JSON, issuer secret keys, distributor secret keys, or recipient key material.

`pnpm stellar:fresh-payout-campaign:testnet` preserves the native testnet XLM SAC fallback path. The browser compliance e2e refuses active metadata that predates `complianceRoot`.

## Browser Claim

Real Testnet Claim mode:

- loads the active campaign through `/api/testnet/config`,
- refuses active deployments that predate `complianceRoot`,
- builds eligibility and compliance witnesses locally in a Web Worker,
- derives `payout_account_hash` from the selected Stellar payout address,
- uses `/zk/claim.wasm`, `/zk/claim_final.zkey`, and `/zk/verification_key.json`,
- verifies the Groth16 proof locally in the browser,
- sends only `proofEncodingForSoroban`, `publicInputs`, public `payoutRecipient`, `campaignContractId`, and `campaignId` to `/api/testnet/claim`.

The relayer is disabled unless:

```txt
LUMEN_TESTNET_RELAYER_ENABLED=true
STELLAR_NETWORK=testnet
STELLAR_SOURCE_ACCOUNT=<local Stellar CLI key name>
```

It rejects mainnet, unknown active campaign IDs, unknown campaign contract IDs, stale active deployments, malformed proof/public input payloads, private witness field names, payout recipient/hash mismatches, compliance root mismatches, and secret-key-shaped `STELLAR_SOURCE_ACCOUNT` values.

## Donor Dashboard

The donor dashboard reads the active testnet campaign and shows:

- campaign contract ID,
- verifier contract ID,
- asset mode, asset code, issuer when available, and asset contract ID,
- campaign ID,
- eligibility root,
- compliance root,
- policy hash,
- budget,
- escrow funded,
- total distributed,
- remaining budget,
- actual token balance,
- claim count,
- duplicate/invalid counters,
- verifier mode from `verifier_info()` when available,
- last browser tx hash, payout recipient, payout amount, recipient balance, escrow balance, and audit commitment availability.

If an old deployed verifier lacks `verifier_info()`, the UI shows:

```txt
Verifier mode: legacy verifier, mode not introspectable
```

## Auditor View

The auditor page can load a local demo disclosure package from the browser. Public donors see commitments and aggregate accounting; the auditor-only view can inspect demo recipient name, demo eligibility reason, demo compliance status, and payout address from the supplied package.

This is product-layer selective disclosure only. It is not a real provider attestation or cryptographic view-key system.

## Disclosure-Only

- Trusted setup is deterministic development-only.
- Compliance roots are deterministic demo roots.
- No real KYC/sanctions provider integration exists.
- Mock token remains for local/demo compatibility and is not the main real payout asset path.
- Local Demo mode uses a simulator/dev verifier envelope.
- `dev_verifier` is a feature/test path, not production ZK.
- Freighter payout address binding is available; direct Freighter transaction signing is not implemented.
- AIDUSD is a testnet issued asset; fresh setup requires a funded source key, but the current active AIDUSD compliance deployment is validated.
- Production audit is not done.
- Mainnet is not supported.
