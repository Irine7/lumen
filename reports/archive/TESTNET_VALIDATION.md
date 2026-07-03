# Lumen Fresh Testnet Validation

Date: 2026-07-01
Network: Stellar testnet
Source account key name used: `admin` (local Stellar CLI key name only; no secret printed)

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| `stellar:doctor` | PASS | `STELLAR_NETWORK=testnet`, `STELLAR_SOURCE_ACCOUNT=admin`, Stellar CLI `25.1.0`, testnet network configured. | `admin` public key matches deployment/operator metadata. |
| read-only campaign state | PASS | `pnpm stellar:read:testnet` read `get_campaign`, `get_stats`, and verifier malformed-proof simulation with `--send no`. | Stats after Bob: total claimed `300`, claim count `2`, remaining `700`. |
| verifier status | PASS WITH DISCLOSURE | Campaign config verifier matches `CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D`; malformed proof returned `false`; Alice and Bob real Groth16 proofs were accepted by verifier simulation. | Deployment metadata says default real Groth16 build; browser read alone cannot attest build mode. |
| positive claim smoke | PASS | `pnpm stellar:claim:bob:testnet` generated Bob proof, local snarkJS verification passed, deployed verifier simulation accepted, campaign accepted amount `175`. | Fresh positive claim used Bob because Alice had already claimed. |
| duplicate claim smoke | PASS | `pnpm stellar:claim:alice-duplicate:testnet` rejected with `DuplicateNullifier #10`. | Duplicate rejection exercises campaign/nullifier logic; failed transaction does not persist counters. |
| wrong root/wrong policy smoke, if available | NOT APPLICABLE | No safe testnet wrong-root/wrong-policy state-changing script exists. | Local `pnpm zk:verify:local` and `pnpm contracts:test` cover wrong root/policy. |

## Deployment Metadata

| Field | Value |
| --- | --- |
| network | `testnet` |
| campaign contract ID | `CCICXWSMCEY47JF2OWQ3OQMZEHVC5URNCWELWHQ2YRJEI2ETWKUAXCWI` |
| verifier contract ID | `CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D` |
| mock token contract ID | `CDCH6ECKA3EHYT7KO3ZXE275W2YCO7PAHRX4G2KGXNIZLFID5HFAFFC7` |
| campaign ID | `0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101` |
| eligibility root | `0x1533dddeb2e62943d31b07f72e99112fca3a7f0b21c5804ea27113c8e60d737a` |
| policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| verifier mode in metadata | `real_groth16_verifier` |
| deployment claim | Metadata says verifier build used default real Groth16 path and `dev_verifier` was not enabled. |

## On-Chain Verifier Truth

Is the deployed verifier the real Groth16 verifier?
PASS WITH DISCLOSURE. Deployment metadata claims real Groth16/default build, local contract tests prove default verifier behavior, and testnet verifier simulation accepted real snarkJS Groth16 proof payloads for Alice and Bob. The contract does not expose a self-describing build-mode method.

Is it dev-only?
No evidence that the deployed verifier is dev-only. The dev verifier is feature-gated in source and default tests reject dev proof payloads.

Is the campaign using that verifier?
Yes. Fresh `get_campaign` returned verifier `CCHDSG4NLE4IWNGXOR46OYQRAW7KA4VQQB7NF4BTRH3D4HJIRBDLRR7D`, matching deployment metadata.

Is the testnet claim script submitting a real proof-compatible payload or a dev envelope?
Real proof-compatible payload. Alice and Bob scripts generate snarkJS Groth16 proofs and convert them to the 256-byte verifier proof encoding. They do not submit the browser `dev_verifier` envelope.

Does the testnet smoke exercise real on-chain verification or only campaign/nullifier logic?
Bob positive claim exercises campaign logic and the deployed verifier path. Alice duplicate rejection exercises campaign/nullifier logic and rejects before verifier acceptance.

## Fresh Testnet Validation Summary

What is testnet-validated:
- Fresh read-only campaign config and stats.
- Campaign contract callable on testnet.
- Verifier contract callable on testnet and rejects malformed proof.
- Bob fresh positive claim with real local Groth16 proof and verifier simulation.
- Alice duplicate rejection with `DuplicateNullifier #10`.

What is still not testnet-validated:
- Browser-submitted testnet claims.
- Browser Groth16 proving.
- Testnet wrong-root/wrong-policy claim submissions.
- Production trusted setup ceremony.
- A contract-exposed verifier build-mode introspection method.

What we must not claim:
- Do not claim Alice first claim was freshly accepted in this run; Alice was already claimed.
- Do not claim browser claims are wired to testnet.
- Do not claim browser proving is real Groth16.
- Do not claim production trusted setup is complete.
