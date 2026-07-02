# Limitations

Lumen is a hackathon prototype. It demonstrates the core privacy/accountability architecture, but it is not production-ready.

## Verification and ZK

- The real local ZK path uses deterministic development Groth16 artifacts.
- Production trusted setup has not been completed.
- Production verification key generation and lifecycle management are future work.
- The circuit has not been externally audited.
- The Soroban verifier contract has not been externally audited.
- Real Testnet Claim mode uses browser Groth16 proving and local verification, then submits proof/public inputs through a local testnet relayer.
- Local Demo mode still uses a `dev_verifier` envelope through a local simulator.
- Browser-submitted testnet claims are testnet-only and relayer-based; Freighter mode and production relayer hardening are not implemented.

## Privacy

- Amounts are public in the MVP.
- The amount commitment exists for future confidential amount support, but confidential transfers are not implemented.
- Network metadata, wallet metadata, RPC metadata, and browser metadata are not hidden.
- Timing correlation and recipient operational security are not solved by this prototype.
- Debug mode intentionally exposes synthetic private witness data and must never be used with real recipient data.
- Demo reveal controls are for synthetic fixtures only.

## Eligibility and policy

- Demo recipients are deterministic synthetic fixtures.
- The project does not include a real NGO/KYC provider integration.
- Eligibility root generation is not independently attested by a third-party or verifiable compute proof.
- Deny-list non-membership is represented in config but is not enforced in the current circuit/contract path.
- Policy updates, appeals, revocation, and recipient recovery flows are not productionized.

## Contracts and assets

- The contracts are prototype contracts and are not audited.
- The mock token is a demo helper, not a production asset integration.
- Production token transfer flows, sponsorship, fees, wallet UX, and transaction submission are not complete.
- Contract upgrade, governance, pause, and emergency response procedures are not finalized.

## Frontend

- The frontend is optimized for hackathon demo clarity, not a production recipient app.
- The frontend local flow uses a simulator-backed campaign client.
- Testnet contract IDs are read from `deployments/active-testnet.json`.
- Browser proving runs in a worker, but production artifact caching/hardening is future work.

## Security and compliance

- No external cryptography audit has been completed.
- No external smart contract audit has been completed.
- No data protection, sanctions, legal, or humanitarian compliance review has been completed.
- Real deployments would require strict handling of eligibility data, recipient consent, key custody, incident response, and NGO operating procedures.

## Accurate public claim

Safe wording:

```txt
Lumen demonstrates private aid eligibility proofs with real local and browser Groth16 proof generation/verification, Soroban campaign contracts, and browser-submitted Stellar testnet claims through a local testnet relayer. The trusted setup is deterministic development-only and the testnet asset is a mock token.
```

Do not use this wording:

```txt
The browser app is production-ready for mainnet aid claims.
```

That is not true.
