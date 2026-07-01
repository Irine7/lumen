# Limitations

Lumen is a hackathon prototype. It demonstrates the core privacy/accountability architecture, but it is not production-ready.

## Verification and ZK

- The real local ZK path uses deterministic development Groth16 artifacts.
- Production trusted setup has not been completed.
- Production verification key generation and lifecycle management are future work.
- The circuit has not been externally audited.
- The Soroban verifier contract has not been externally audited.
- The browser demo uses a `dev_verifier` envelope through a local simulator; it is not browser-submitted production ZK.
- Browser-submitted testnet claims are not wired yet.

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
- Testnet contract IDs can be displayed/documented, but browser claim submission to those contracts is future work.
- Browser proving is not moved into a production worker with artifact caching yet.

## Security and compliance

- No external cryptography audit has been completed.
- No external smart contract audit has been completed.
- No data protection, sanctions, legal, or humanitarian compliance review has been completed.
- Real deployments would require strict handling of eligibility data, recipient consent, key custody, incident response, and NGO operating procedures.

## Accurate public claim

Safe wording:

```txt
Lumen demonstrates private aid eligibility proofs with real local Groth16 proof generation/verification, Soroban campaign contracts, and a deployed testnet Groth16 verifier smoke path. The browser demo uses a dev-only simulator envelope and is not production ZK.
```

Do not use this wording:

```txt
The browser app submits production ZK claims on-chain.
```

That is not true yet.
