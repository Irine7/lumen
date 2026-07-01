# Deployment

Canonical testnet deployment and smoke-test commands:

```bash
pnpm stellar:doctor
pnpm contracts:build
pnpm stellar:deploy:testnet
pnpm stellar:init-campaign:testnet
pnpm stellar:claim:alice:testnet
pnpm stellar:claim:alice-duplicate:testnet
```

Set `STELLAR_SOURCE_ACCOUNT` to a funded local Stellar CLI key name before running testnet commands. Do not put private keys in `.env`, shell history, or deployment JSON.

PowerShell example:

```powershell
$env:STELLAR_SOURCE_ACCOUNT = "admin"
```

Current Stellar testnet deployment:

```txt
network    = testnet
verifier   = CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D
campaign   = CCICXWSMCEY47JF2OWQ3OQMZEHVC5URNCWELWHQ2YRJEI2ETWKUAXCWI
mock token = CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7
deployer   = GA4SHBKMWY33KHX5C3QNX6DTRRVARVMPBANAY7HLWMHWI6ONW6VN2WK7
```

Public metadata files:

```txt
deployments/testnet.json
deployments/testnet-campaign.json
deployments/testnet-alice-claim.json
deployments/testnet-alice-duplicate-claim.json
```

Campaign values:

```txt
campaign_id      = 0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101
eligibility_root = 0x1533dddeb2e62943d31b07f72e99112fca3a7f0b21c5804ea27113c8e60d737a
policy_hash      = 0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21
alice_nullifier  = 0x304839a43cd2b03a7c030591abb845e56e4fa662d30f2540656df7b825887c66
```

Verifier status:

```txt
Local cryptographic proof verification: real.
On-chain cryptographic proof verification: real for the deployed testnet verifier.
Browser/frontend claim submission: still local simulator-backed.
```

The verifier contract was deployed without the `dev_verifier` feature. Alice's testnet smoke test regenerates a snarkjs Groth16 proof, verifies it locally, simulates verification against the deployed verifier, and submits the claim through the deployed campaign contract. The duplicate smoke test resubmits the same nullifier and expects `DuplicateNullifier #10`.
