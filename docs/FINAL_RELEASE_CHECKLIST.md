# Final Release Checklist

## Before recording/demo

- [ ] `pnpm judge:validate:testnet` passed.
- [ ] `pnpm judge:prepare-demo:testnet` passed.
- [ ] Open `/demo`.
- [ ] Confirm campaign state is pristine.
- [ ] Confirm AIDUSD escrow funded.
- [ ] Confirm verifier mode is `real_groth16`.
- [ ] Confirm disclosures are visible.
- [ ] Do not rerun state-changing e2e on the pristine demo campaign.

## Demo sequence

1. Open `/demo`.
2. Open Donor dashboard.
3. Open Recipient.
4. Claim as Dora.
5. Try duplicate Dora.
6. Try Eve non-compliant.
7. Try Mallory ineligible.
8. Open Donor dashboard again.
9. Open Auditor disclosure.

## Must not claim

- production trusted setup,
- production audit,
- mainnet support,
- real KYC/sanctions provider,
- private amounts,
- hidden payout addresses,
- production relayer.
