# Stellar Testnet Deployment

This document describes how to prepare and deploy Lumen contracts to Stellar testnet. It does not change protocol logic.

For the current compliance-grade payout path, prefer the AIDUSD/native SAC deployment commands in `docs/PAYOUT_FLOW.md` and `docs/COMPLIANCE_FLOW.md`. The mock-token deployment notes below remain useful for legacy/local testnet exercises, but they are not the main real payout path.

## Status

The repository now has deployment-prep checks and contract WASM builds:

```bash
pnpm stellar:doctor
pnpm contracts:build
pnpm stellar:deploy:testnet
pnpm stellar:init-campaign:testnet
pnpm stellar:claim:alice:testnet
pnpm stellar:claim:alice-duplicate:testnet
```

Public testnet contract IDs are recorded in `deployments/testnet.json` after `pnpm stellar:deploy:testnet`. A deployer must provide a funded Stellar CLI source account outside the repository.

Legacy mock-token contract IDs from an earlier testnet deployment:

```txt
verifier   = CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D
campaign   = CCICXWSMCEY47JF2OWQ3OQMZEHVC5URNCWELWHQ2YRJEI2ETWKUAXCWI
mock token = CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7
```

## Prerequisites

- Node.js 20+ and pnpm.
- Rust and Cargo.
- Stellar CLI.
- Rust WASM target:

```bash
rustup target add wasm32v1-none
```

- Stellar testnet network configured:

```bash
stellar network add --global testnet --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015"
```

- Funded Stellar CLI source account:

```bash
stellar keys generate lumen-deployer --network testnet --fund
```

Set the deployment environment:

```bash
STELLAR_NETWORK=testnet
STELLAR_SOURCE_ACCOUNT=lumen-deployer
```

On PowerShell:

```powershell
$env:STELLAR_NETWORK = "testnet"
$env:STELLAR_SOURCE_ACCOUNT = "lumen-deployer"
```

## Validate Environment

```bash
pnpm stellar:doctor
```

The doctor checks:

- `stellar` CLI is installed.
- `rustc` and `cargo` are installed.
- `wasm32v1-none` target is installed.
- `STELLAR_NETWORK` is exactly `testnet`.
- Stellar CLI has a configured `testnet` network.
- `STELLAR_SOURCE_ACCOUNT` names an available local Stellar CLI key.

## Build Contract WASM

```bash
pnpm contracts:build
```

Expected artifacts:

```txt
target/wasm32v1-none/release/lumen_verifier.wasm
target/wasm32v1-none/release/lumen_campaign.wasm
target/wasm32v1-none/release/lumen_mock_token.wasm
```

The verifier build uses the real Groth16 verifier by default. The dev verifier is not enabled by `pnpm contracts:build`.

## Deploy Contracts

Use the scripted deploy:

```bash
pnpm stellar:deploy:testnet
```

The script:

1. Requires `STELLAR_SOURCE_ACCOUNT` to be a local Stellar CLI key name, not an `S...` secret key.
2. Runs `pnpm stellar:doctor`.
3. Runs `pnpm contracts:build`.
4. Deploys verifier, mock token, and campaign contracts to `testnet`.
5. Writes `deployments/testnet.json`.

The output file shape is:

```json
{
  "network": "testnet",
  "campaignContractId": "...",
  "verifierContractId": "...",
  "mockTokenContractId": "...",
  "deployerPublicKey": "...",
  "deployedAt": "...",
  "notes": "..."
}
```

Private keys are never written to this file.

Fresh compliance-aware active deployment metadata must also include `complianceRoot`, `assetMode`, `assetCode`, and `assetContractId`. AIDUSD deployments must include only public issuer/distributor addresses and contract IDs, never issuer or recipient secret keys.

Manual equivalent commands are below for transparency.

Deploy the verifier:

```bash
stellar contract deploy --wasm target/wasm32v1-none/release/lumen_verifier.wasm --source-account "$STELLAR_SOURCE_ACCOUNT" --network testnet
```

Save the returned contract ID:

```bash
VERIFIER_CONTRACT_ID=<returned verifier contract id>
```

Deploy the mock token if the demo is using the local mock token path:

```bash
stellar contract deploy --wasm target/wasm32v1-none/release/lumen_mock_token.wasm --source-account "$STELLAR_SOURCE_ACCOUNT" --network testnet
```

Save the returned contract ID:

```bash
MOCK_TOKEN_CONTRACT_ID=<returned mock token contract id>
```

Deploy the campaign:

```bash
stellar contract deploy --wasm target/wasm32v1-none/release/lumen_campaign.wasm --source-account "$STELLAR_SOURCE_ACCOUNT" --network testnet
```

Save the returned contract ID:

```bash
CAMPAIGN_CONTRACT_ID=<returned campaign contract id>
```

## Configure Frontend After Deployment

Set the public contract IDs for the web app:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID=$CAMPAIGN_CONTRACT_ID
NEXT_PUBLIC_VERIFIER_CONTRACT_ID=$VERIFIER_CONTRACT_ID
NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID=$MOCK_TOKEN_CONTRACT_ID
```

## Initialize Campaign

```bash
pnpm stellar:init-campaign:testnet
```

This initializes the deployed campaign with:

```txt
campaign_id      = 0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101
eligibility_root = 0x1533dddeb2e62943d31b07f72e99112fca3a7f0b21c5804ea27113c8e60d737a
policy_hash      = 0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21
budget           = 1000
per_recipient_cap = 250
```

It writes:

```txt
deployments/testnet-campaign.json
```

## Claim Smoke Test

Alice first claim:

```bash
pnpm stellar:claim:alice:testnet
```

Expected:

```txt
Alice first claim accepted on testnet
```

If the claim has already been submitted, the command reports the existing accepted evidence file because Alice's nullifier is intentionally single-use.

Alice duplicate:

```bash
pnpm stellar:claim:alice-duplicate:testnet
```

Expected:

```txt
Alice duplicate claim rejected on testnet
```

The duplicate rejection is `DuplicateNullifier #10`.

Status:

```txt
Local cryptographic proof verification: real.
On-chain cryptographic proof verification: real.
Testnet mode: deployed campaign + real verifier smoke test.
```

## Current Compliance-Aware Testnet Status

- Browser Groth16 proof generation and browser local verification are implemented.
- Browser-submitted compliance-aware AIDUSD testnet claims are implemented through the local testnet relayer.
- Current public active contract IDs are recorded in `deployments/active-testnet.json`.
- Legacy mock-token deployment notes above remain historical/local reference material.
- Production trusted setup is not complete.
