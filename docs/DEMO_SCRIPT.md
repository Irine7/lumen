# Lumen Demo Script

Use this for a short DoraHacks demo. Keep the language precise: this is a validated Stellar testnet prototype, not a production deployment.

## Setup

Recommended judge setup:

```bash
pnpm install --frozen-lockfile
pnpm web:zk:prepare
pnpm stellar:aidusd:active:testnet
pnpm judge:validate:testnet
pnpm judge:prepare-demo:testnet
pnpm dev
```

Open:

```txt
http://localhost:3000/demo
```

`judge:validate:testnet` creates and consumes a validation campaign. `judge:prepare-demo:testnet` should be run after it so the active Dora campaign is pristine for the walkthrough.

## 3 minute script

### 0:00-0:25 - Problem

"Lumen is private, ZK-compliant aid disbursements on Stellar. Public payment rails help donors audit spending, but they can also expose vulnerable recipients. Lumen lets a recipient prove eligibility and compliance clearance without publishing their identity, private witness, or Merkle path."

Show `/demo` and the product flow.

### 0:25-0:55 - Architecture

"The operator publishes an eligibility root, compliance root, and policy hash. Dora generates a Groth16 proof in the browser. The browser verifies the proof locally, then a local testnet relayer submits only proof/public inputs to Soroban. The campaign contract calls the `real_groth16` verifier and transfers AIDUSD from SAC escrow if the claim is valid."

Point out:

- `eligibility_root`
- `compliance_root`
- `payout_account_hash`
- `nullifier_hash`
- AIDUSD/SAC escrow

### 0:55-1:20 - Donor dashboard before claim

Open the Donor dashboard from `/demo`.

Say:

"This is the current pristine demo campaign. The escrow is funded with 1000 testnet AIDUSD, and the campaign starts at zero claims. Donors see aggregate state, not a recipient list."

Show:

- campaign contract,
- verifier contract,
- AIDUSD SAC,
- escrow/budget,
- verifier mode,
- roots.

### 1:20-2:00 - Dora valid claim

Open Recipient from `/demo`.

1. Select Dora.
2. Generate the browser proof.
3. Show browser local verification.
4. Submit the claim.
5. Show the accepted testnet result.

Say:

"Dora is eligible and compliance-cleared. The private fields stay local. The public claim contains the campaign commitments, nullifier, public amount, payout account hash, and proof. The payout address is public, but it is bound to the proof so a relayer cannot swap the recipient."

### 2:00-2:25 - Rejections

Run the guided rejection scenarios:

1. Try duplicate Dora.
2. Select Eve.
3. Select Mallory.

Say:

"The duplicate Dora claim is rejected by the nullifier with no second transfer. Eve is eligible but not compliance-cleared, so proof generation fails before submission. Mallory is not eligible, so she also fails before submission."

If showing swapped payout:

"A swapped payout is rejected in validation because the submitted recipient no longer matches `payout_account_hash`."

### 2:25-2:45 - Donor dashboard after claim

Return to Donor dashboard and refresh.

Say:

"The donor dashboard now reflects live testnet state: one accepted claim, updated escrow and remaining budget, and the same public campaign commitments. Accountability is aggregate; recipient identity and private witness data are not published."

### 2:45-3:00 - Auditor disclosure and honesty boundary

Open Auditor disclosure.

Say:

"The auditor view is a demo selective disclosure package. It shows how a bounded audit package could connect Dora's disclosed fields to commitments, but it is not production view-key infrastructure. This project is testnet-only, uses a deterministic development trusted setup, has demo compliance roots, no production audit, no mainnet, and no real KYC or sanctions provider."

## Current pristine demo deployment

| Field | Value |
| --- | --- |
| Demo URL | `http://localhost:3000/demo` |
| Campaign contract | `CCS7WTPLZI36VSQU2T3EKJRNJKGBYMRKNAVAFMSTPL2CJWCMNG2HJSZH` |
| Verifier contract | `CDK6HSLEZRVIHLLQSEH6LQGXBHYNPL7VXO3W4QN4WVB4C4R5A466SYQZ` |
| AIDUSD SAC | `CBRLWLJH3X2JPIB5UEUXHXDE6KKEZ3MCCVAT6STRAKP2SM52VR5DQTLQ` |
| Campaign ID | `0x00405cc1adafb8ac4ea9b6a8f390d2a2f9565304765480dd4da3c3ff33bce37c` |
| Escrow | `1000` AIDUSD |
| State | `pristine`; `claim_count=0`, `total_claimed=0`, `remaining_budget=1000` |

## Quick checklist

- Open `/demo`.
- Donor dashboard shows pristine state.
- Dora claim generates browser Groth16 proof and passes local verification.
- Dora relayed testnet claim succeeds.
- Duplicate Dora rejects.
- Eve non-compliant rejects before submission.
- Mallory ineligible rejects before submission.
- Donor dashboard refreshes live state.
- Auditor disclosure opens and is described as demo-only.

## Do not say

- "Production-ready."
- "Audited."
- "Mainnet-ready."
- "Real KYC/sanctions integration."
- "Private amounts."
- "Private payout addresses."
- "Production auditor view keys."
- "Wallet signing is complete."
- "Every negative case is a submitted transaction."
