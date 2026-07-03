# Limitations

Lumen is a compliance-grade private aid payout prototype on Stellar testnet. It is not production-ready and must not be described as mainnet-ready, audited, or integrated with a real compliance provider.

## Verification And ZK

- The real local and browser ZK paths use deterministic development Groth16 artifacts.
- Production trusted setup has not been completed.
- Production verification key generation and lifecycle management are future work.
- The circuit has not been externally audited.
- The Soroban verifier contract has not been externally audited.
- Real Testnet Claim mode uses browser Groth16 proving and local verification, then submits proof/public inputs through a local testnet relayer.
- Local Demo mode still uses a `dev_verifier` envelope through a local simulator.
- Browser-submitted testnet claims are testnet-only and relayer-based.

## Compliance

- Compliance clearance is implemented as membership in a deterministic demo compliance root.
- There is no real KYC, sanctions, fraud, or humanitarian compliance provider integration.
- The `policyHash` currently folds the demo compliance-provider/policy scope; there is no separately attested provider public input.
- Deny-list non-membership is not enforced yet.
- Eligibility root and compliance root construction are not independently attested by a third party or verifiable compute proof.
- Policy updates, appeals, revocation, recipient recovery, and stale-clearance handling are not productionized.

## Privacy

- Amounts are public in the MVP.
- The amount commitment exists for future confidential amount support, but confidential transfers are not implemented.
- Payout addresses are public Stellar addresses and can be observed on-chain.
- Network metadata, wallet metadata, RPC metadata, and browser metadata are not hidden.
- Timing correlation and recipient operational security are not solved by this prototype.
- Debug mode intentionally exposes synthetic private witness data and must never be used with real recipient data.
- Demo reveal controls are for synthetic fixtures only.
- Auditor selective disclosure packages are local demo artifacts; they are not a cryptographic view-key system.

## Contracts And Assets

- The contracts are prototype contracts and are not audited.
- The preferred AIDUSD testnet SAC path has scripts for issuer/distributor setup, SAC deployment/resolution, trustlines, escrow funding, smoke testing, and browser e2e. Live testnet validation passed on July 2, 2026, but it remains testnet-only.
- AIDUSD is a testnet issued asset, not production money or a mainnet stablecoin integration.
- Native testnet XLM SAC payout remains the preserved fallback path.
- Compliance browser e2e refuses stale active deployments that lack `complianceRoot` or the current verifier key.
- The mock token is a demo helper, not the main real payout path.
- Production token transfer flows, sponsorship, fees, wallet UX, and transaction submission are not complete.
- Contract upgrade, governance, pause, and emergency response procedures are not finalized.
- Soroban event publishing still produces deprecation warnings; event macro modernization remains future work.

## Frontend And Wallets

- Freighter payout address binding is implemented.
- Direct Freighter transaction signing is not implemented.
- Sponsored claim submission uses a local testnet relayer; this is not production infrastructure.
- The frontend local flow uses a simulator-backed campaign client.
- Testnet contract IDs are read from `deployments/active-testnet.json`.
- Browser proving runs in a worker, but production artifact caching/hardening is future work.

## Security And Operations

- No external cryptography audit has been completed.
- No external smart contract audit has been completed.
- No data protection, sanctions, legal, or humanitarian compliance review has been completed.
- No mainnet support is implemented.
- Real deployments would require strict handling of eligibility data, compliance data, recipient consent, key custody, incident response, provider contracts, and NGO operating procedures.

## Accurate Technical Claim

Safe wording:

```txt
Lumen is a compliance-grade private aid payout prototype on Stellar testnet: browser Groth16 proof generation and local verification, private eligibility plus demo compliance clearance membership, proof-bound payout recipient, Soroban verifier/campaign checks, testnet SAC escrow payout, duplicate/non-compliant/ineligible/swapped-payout rejection, donor aggregate accountability, and local demo auditor selective disclosure.
```

Required disclosures:

```txt
Deterministic development trusted setup, demo compliance roots, no real KYC/sanctions provider integration, local testnet relayer, no direct Freighter signing, no production audit, no mainnet support, and public amounts.
```

Do not use this wording:

```txt
The browser app is production-ready for mainnet aid claims.
```

That is not true.
