# Roadmap

This roadmap lists concrete next steps after the hackathon prototype. It intentionally avoids adding new claims to the current submission.

## Phase 1 - Production ZK foundation

- Replace deterministic development Groth16 setup with a production trusted setup ceremony.
- Generate production verification keys.
- Add scripts to derive Soroban verifier constants from production verification keys.
- Version circuit artifacts and verifier keys by circuit ID.
- Add reproducible artifact checksums.
- Expand negative proof test vectors.

## Phase 2 - Browser proving and testnet UX

- Move proving into a browser worker.
- Cache proving artifacts safely in the browser.
- Add progress states and failure recovery for proving.
- Wire browser claim submission to deployed testnet contracts.
- Integrate wallet signing, starting with Freighter.
- Add clear network/testnet/mainnet environment indicators.

## Phase 3 - Privacy improvements

- Implement confidential amount support.
- Use amount commitments with a private amount flow.
- Add auditor view keys or selective disclosure for approved reviewers.
- Reduce metadata leakage in frontend and RPC workflows.
- Add guidance for recipient operational privacy.

## Phase 4 - Eligibility operations

- Integrate real NGO/KYC provider workflows without putting raw eligibility data on-chain.
- Add verifiable eligibility root generation.
- Explore RISC Zero or another verifiable compute path for root generation attestations.
- Add deny-list non-membership proofs.
- Add recipient recovery and appeal flows.
- Add policy versioning and root rotation workflows.

## Phase 5 - Donor and operator tooling

- Export donor accountability reports.
- Add campaign lifecycle controls for open, pause, close, and root update flows.
- Add role-based operator controls.
- Add audit logs and monitoring.
- Add alerts for duplicate/invalid claim spikes.

## Phase 6 - Security and production readiness

- Complete external circuit audit.
- Complete external smart contract audit.
- Complete frontend and infrastructure security review.
- Add incident response and key management procedures.
- Add production token integration.
- Add governance and upgrade strategy.
- Run a limited pilot with synthetic or consented non-sensitive data before handling real recipient data.

## Near-term hackathon follow-up checklist

- Publish demo video.
- Publish testnet deployment evidence.
- Add screenshots to the submission.
- Add a short verifier status callout in the project description.
- Keep `docs/VERIFIER_STATUS.md` as the source of truth for future copy changes.
