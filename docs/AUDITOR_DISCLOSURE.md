# Auditor Selective Disclosure

## Scope

The auditor panel is a product-layer demo disclosure workflow. It is not a new cryptographic view-key system, not production view keys, and does not imply a real KYC, sanctions, or compliance provider integration.

Public donors see aggregate campaign accounting. Auditors can inspect a scoped local demo package when the operator or recipient provides it.

## Package Shape

After a successful browser claim, the recipient page stores a local demo audit package in browser storage:

```json
{
  "campaignId": "0x...",
  "claimTxHash": "...",
  "nullifierHash": "0x...",
  "amount": "250",
  "asset": "AIDUSD or XLM fallback",
  "payoutAccountHash": "0x...",
  "eligibilityRoot": "0x...",
  "complianceRoot": "0x...",
  "policyHash": "0x...",
  "auditCommitment": "0x...",
  "proofVerified": true,
  "recipientDisclosure": {
    "demoRecipientName": "Dora",
    "eligibilityReason": "Emergency medical aid",
    "complianceStatus": "cleared",
    "payoutAddress": "G..."
  },
  "demoOnly": true
}
```

`auditCommitment` is computed off-chain as:

```txt
SHA-256(campaignId, nullifierHash, amount, payoutAccountHash, policyHash, complianceRoot)
```

The package is not public by default, is not written on-chain, and must not contain private witness values such as secrets, salts, identity hashes, or Merkle paths.

## Auditor Page

`apps/web/app/auditor` shows two views:

- Public view: campaign ID, tx hash, nullifier, amount, asset, payout account hash, eligibility root, compliance root, policy hash, proof status, and audit commitment.
- Selective disclosure view: demo recipient name, demo eligibility reason, demo compliance status, and payout address from the loaded package.

The page explicitly labels the package as demo-only and does not claim real provider evidence.

## Donor Boundary

The donor dashboard may show:

```txt
Audit commitment: available
Selective disclosure: auditor-only
```

It must not show private witness data, real-world identity data, or demo recipient reasons by default.

## Not Implemented

- Real auditor credentialing.
- Real provider-signed compliance attestations.
- Cryptographic view keys.
- On-chain PII or on-chain disclosure package storage.
- Legal hold, retention, export controls, or audit workflow governance.
