# Lumen Judge Walkthrough

This walkthrough is the final judge-facing path for the DoraHacks demo package. It uses the current pristine AIDUSD testnet campaign and avoids overclaiming production readiness.

## What to run

```bash
pnpm install --frozen-lockfile
pnpm web:zk:prepare
pnpm stellar:aidusd:active:testnet
pnpm judge:validate:testnet
pnpm judge:prepare-demo:testnet
pnpm dev
```

Notes:

- `pnpm stellar:aidusd:active:testnet` is read-only.
- `pnpm judge:validate:testnet` creates and consumes a separate validation campaign.
- `pnpm judge:prepare-demo:testnet` creates the pristine Dora demo campaign and should be the final state-changing prep command before the live walkthrough.
- Do not run state-changing smoke/e2e commands against the pristine demo campaign unless you intend to prepare a fresh demo again.

## Current pristine demo deployment

| Field | Value |
| --- | --- |
| Demo URL | `http://localhost:3000/demo` |
| Network | `testnet` |
| Asset | `AIDUSD` |
| AIDUSD SAC | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign contract | `CCS7WTPLZI36VSQU2T3EKJRNJKGBYMRKNAVAFMSTPL2CJWCMNG2HJSZH` |
| Verifier contract | `CDK6HSLEZRVIHLLQSEH6LQGXBHYNPL7VXO3W4QN4WVB4C4R5A466SYQZ` |
| Campaign ID | `0x00405cc1adafb8ac4ea9b6a8f390d2a2f9565304765480dd4da3c3ff33bce37c` |
| Eligibility root | `0x2b070984377730cd19cb263f65a7ace043bd63cb3e45fa474017e9b52b08fd7e` |
| Compliance root | `0x0a2138537cf03c3f72667f1a3436b6599b77363f681e4e44df5cb7f11fca665e` |
| Policy hash | `0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21` |
| Verifier mode | `real_groth16` |
| VK hash | `0xf3be0265175696a6ecc1530ad5789f1ac0e0e899dee49ff066a049545db64e92` |
| Escrow funded | `1000` AIDUSD |
| Pristine state | `claim_count=0`, `total_claimed=0`, `remaining_budget=1000` |

## Walkthrough

### 1. Open `/demo`

Open `http://localhost:3000/demo`.

Expected: the command center shows a pristine campaign and links to Donor, Recipient, and Auditor views.

### 2. Donor dashboard

Open Donor dashboard.

Expected:

- AIDUSD/SAC campaign metadata is visible.
- Verifier mode is `real_groth16`.
- Eligibility and compliance roots match the active deployment.
- Budget/escrow starts at `1000`, with zero claimed if the pristine campaign has not been used.

Talking point: donors get live aggregate accountability without a public recipient list.

### 3. Recipient Dora claim

Open Recipient.

1. Select Dora.
2. Generate the proof.
3. Confirm browser local verification passes.
4. Submit the relayed testnet claim.

Expected: Dora receives the accepted testnet payout from AIDUSD/SAC escrow.

Technical points:

- The browser generates a Groth16 proof.
- The proof covers eligibility and compliance membership.
- The public input `payout_account_hash` binds Dora's payout address.
- The relayer receives proof/public inputs, not recipient secrets or Merkle paths.

### 4. Duplicate Dora

Submit Dora again.

Expected: duplicate claim is rejected by the campaign nullifier path and does not produce a second payout.

Technical point: `nullifier_hash` prevents repeat claims without revealing identity.

### 5. Eve non-compliant

Select Eve.

Expected: Eve fails before submission because she is not in the compliance-cleared root.

Disclosure: this is a demo compliance root, not a real provider integration.

### 6. Mallory ineligible

Select Mallory.

Expected: Mallory fails before submission because she is not in the eligibility root.

### 7. Donor dashboard refresh

Return to Donor dashboard and refresh.

Expected: live campaign totals update after Dora's accepted claim. Remaining budget and escrow should decrease by Dora's testnet claim amount.

### 8. Auditor disclosure

Open Auditor disclosure.

Expected: the page shows Dora's demo selective disclosure package and commitment context.

Disclosure: this package is demo-only and is not production view-key or compliance-reporting infrastructure.

## What is working

- Live AIDUSD compliance-aware private aid payout on Stellar testnet.
- Browser Groth16 proof generation.
- Eligibility and compliance clearance proof.
- Payout-bound recipient with `payout_account_hash`.
- Browser local verification.
- Relayed testnet submission.
- Soroban verifier/campaign validation.
- AIDUSD/SAC escrow transfer.
- Duplicate, non-compliant, ineligible, and swapped-payout rejection paths validated.
- Donor live dashboard.
- Auditor selective disclosure demo package.

## Demo/testnet disclosures

- Deterministic development trusted setup.
- Demo compliance roots.
- Local testnet relayer.
- Testnet AIDUSD.
- No production audit.
- No mainnet.
- No real KYC/sanctions provider.
- Public amounts and payout addresses.
- Auditor package is demo-only.

## Must not claim

- Production-ready, audited, or mainnet-ready.
- Real-world KYC/sanctions integration.
- Private amounts or private payout addresses.
- Production trusted setup.
- Production auditor view keys.
- Direct wallet signing.
- That Eve/Mallory are submitted failed transactions; they fail before submission.
- That swapped-payout rejection is a normal live transfer attempt; it is validated safely without consuming the pristine demo campaign.
