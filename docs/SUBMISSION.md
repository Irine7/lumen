# Lumen DoraHacks Submission

## DoraHacks title

Lumen

## One-liner

Private, ZK-compliant aid disbursements on Stellar.

## Short description

Lumen lets aid recipients privately prove eligibility and compliance clearance, then receive AIDUSD testnet payouts from a Soroban escrow. The demo generates a browser Groth16 proof, verifies it locally, submits only proof/public inputs through a relayer, and shows donor/auditor views without publishing recipient identity or private witness data.

## Full description

Public payment rails are useful for humanitarian aid because donors and operators can audit aggregate spending. The same transparency can harm recipients: a public payment trail can reveal who received disaster relief, medical help, or household support, and can expose timing, amount, and wallet relationships.

Lumen separates private recipient eligibility from public campaign accountability. An operator publishes eligibility and compliance Merkle roots plus a policy hash. A recipient proves, in zero knowledge, that they are in both roots, that their claim is within the cap, and that the payout address is bound into the proof. The public claim carries commitments, a nullifier, amount, payout account hash, and proof bytes, not identity data or Merkle paths.

Stellar is a strong fit because it is built for low-cost payments, stablecoin-style assets, fast settlement, and Soroban smart contracts. In the current demo, a Soroban campaign contract holds AIDUSD/SAC escrow, calls a real Groth16 verifier contract, rejects invalid claims, stores used nullifiers, and updates donor-facing aggregate state.

ZK is used where privacy matters most: proving eligibility and compliance without publishing the private witness. Donors still get a live dashboard with budget, claimed amount, remaining escrow, roots, verifier mode, and transaction state.

## Technical description

- Circom/Groth16 claim circuit with browser proof generation through a web worker.
- Browser local verification runs before relayer submission.
- The circuit uses 10 public inputs and 17 private witness fields.
- Public inputs include `eligibility_root`, `compliance_root`, `payout_account_hash`, `nullifier_hash`, amount, cap, commitments, campaign ID, and policy hash.
- Private witness fields include recipient secret, identity hash, salts, and fixed-depth Merkle paths/indices for the eligibility and compliance trees.
- `nullifier_hash` prevents duplicate claims without revealing recipient identity.
- `payout_account_hash` binds the Stellar payout recipient to the proof so swapped payout attempts fail.
- The relayer receives only proof/public inputs plus the payout recipient needed for submission; it does not receive recipient secrets, Merkle paths, or private input JSON.
- Soroban `real_groth16` verifier validates the current `claim_v0` proof path on Stellar testnet.
- The campaign contract checks roots, policy, amount cap, budget, duplicate nullifier status, verifier result, and payout binding before transferring AIDUSD.
- AIDUSD is held in SAC escrow and transferred on accepted testnet claims.
- The donor dashboard reads live campaign state.
- The auditor page shows a demo selective disclosure package for Dora, with commitments and bounded disclosure fields.

Validated flow:

```txt
browser Groth16 proof
-> eligibility + compliance clearance proof
-> payout-bound recipient
-> browser local verification
-> relayed testnet submission
-> Soroban verifier/campaign
-> AIDUSD/SAC escrow transfer
-> duplicate/non-compliant/ineligible/swapped-payout rejection
-> donor live dashboard
-> auditor selective disclosure package
```

## What is working

- Browser Groth16 proof generation for the demo recipient Dora.
- Browser local proof verification before submission.
- Eligibility and compliance Merkle membership proof.
- Proof-bound payout recipient through `payout_account_hash`.
- Relayed Stellar testnet submission using proof/public inputs only.
- Soroban verifier/campaign flow with `real_groth16` verifier mode.
- AIDUSD/SAC escrow payout on accepted testnet claims.
- Duplicate Dora rejection with no second transfer.
- Eve non-compliant rejection before submission.
- Mallory ineligible rejection before submission.
- Swapped payout rejection in validation/no-send checks.
- Donor live dashboard refresh against testnet campaign state.
- Auditor selective disclosure demo package.
- Current judge demo campaign is pristine with `claim_count=0`, `total_claimed=0`, and `remaining_budget=1000`.

## What is demo/testnet only

- Deterministic development trusted setup and verification key.
- Demo eligibility and compliance roots.
- Local testnet relayer.
- Testnet AIDUSD issued for the demo.
- No production audit.
- No mainnet deployment or mainnet support.
- No real KYC/sanctions provider integration.
- Public amounts and public payout addresses.
- Auditor package is demo-only and is not production view-key infrastructure.

## Commands for judges

```bash
pnpm install --frozen-lockfile
pnpm web:zk:prepare
pnpm stellar:aidusd:active:testnet
pnpm judge:validate:testnet
pnpm judge:prepare-demo:testnet
pnpm dev
```

`pnpm judge:validate:testnet` creates and consumes a separate validation campaign. Run `pnpm judge:prepare-demo:testnet` after it to recreate a pristine Dora demo campaign before recording or presenting.

## Current pristine demo deployment

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Demo URL | `http://localhost:3000/demo` |
| Campaign contract | `CCS7WTPLZI36VSQU2T3EKJRNJKGBYMRKNAVAFMSTPL2CJWCMNG2HJSZH` |
| Verifier contract | `CDK6HSLEZRVIHLLQSEH6LQGXBHYNPL7VXO3W4QN4WVB4C4R5A466SYQZ` |
| AIDUSD SAC | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Asset issuer | `GDOY2OM6324SAIHXFGTNHYJMKMA25RTTVW2OGIDXO7DMRNVLKPBYB5ZM` |
| Campaign ID | `0x00405cc1adafb8ac4ea9b6a8f390d2a2f9565304765480dd4da3c3ff33bce37c` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| Verifier mode | `real_groth16` |
| Verification key hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` AIDUSD |
| Current pristine state | `claim_count=0`, `total_claimed=0`, `remaining_budget=1000` |

## Demo walkthrough

1. Open `/demo`.
2. Open the Donor dashboard and confirm the pristine campaign state.
3. Open Recipient and run the Dora claim.
4. Try duplicate Dora and show rejection.
5. Select Eve and show non-compliant rejection before submission.
6. Select Mallory and show ineligible rejection before submission.
7. Refresh the Donor dashboard and show updated live campaign totals.
8. Open Auditor disclosure and show the demo selective disclosure package.

## Must not claim

- Do not claim production readiness.
- Do not claim the system is audited.
- Do not claim mainnet deployment or mainnet support.
- Do not claim integration with a real KYC, sanctions, NGO, banking, or compliance provider.
- Do not claim the trusted setup is production-grade.
- Do not claim confidential amounts; amounts are public in this demo.
- Do not claim payout addresses are private; payout addresses are public and proof-bound.
- Do not claim the auditor package is production view-key infrastructure.
- Do not claim direct Freighter signing; browser testnet submission uses a local relayer.
- Do not claim all negative cases are submitted transactions; Eve and Mallory fail before submission, and swapped-payout validation is no-send/simulation unless separately stated.
- Do not rerun state-changing validation against the pristine demo campaign unless intentionally preparing a fresh demo afterward.
