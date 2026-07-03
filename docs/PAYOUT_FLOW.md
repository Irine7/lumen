# Payout Flow

## Real Testnet Path

```txt
operator creates campaign with eligibility_root + compliance_root + policy_hash
-> operator funds campaign escrow with a testnet SAC asset
-> recipient selects a Stellar payout address
-> browser derives payout_account_hash
-> browser generates Groth16 proof locally
-> proof public inputs include eligibility_root, compliance_root, policy_hash, and payout_account_hash
-> browser verifies proof locally
-> browser sends proof/public inputs + payout recipient to the local testnet relayer
-> relayer rejects private witness fields and recomputes payout_account_hash
-> campaign checks campaign ID, eligibility root, compliance root, policy hash, cap, nullifier, and payout binding
-> Soroban verifier verifies the Groth16 proof
-> campaign transfers testnet SAC escrow value to payout_recipient
-> donor dashboard refreshes tx hash, distributed amount, escrow, balance, and aggregate counters
-> recipient browser writes a local demo audit package for auditor-only inspection
```

## Public Values

| Value | Purpose |
| --- | --- |
| `campaignId` | Public campaign domain separator. |
| `eligibilityRoot` | Public commitment to the eligible demo recipient set. |
| `complianceRoot` | Public commitment to the compliance-cleared demo recipient set. |
| `policyHash` | Public campaign policy and demo provider-scope commitment. |
| `payoutRecipient` | Public Stellar `G...` or `C...` address receiving the payout. |
| `payoutAccountHash` | BN254-safe SHA-256-derived hash of the canonical payout address bytes. |
| `amount` | Public payout amount in the current MVP. |
| `nullifierHash` | Public duplicate-claim guard. |
| proof bytes | Public Groth16 proof encoding for Soroban. |

Private recipient secrets, identity hashes, salts, eligibility paths, compliance paths, and witness files stay in the browser worker or ignored local build/temp artifacts.

## Asset And Escrow

Preferred path:

```txt
AIDUSD issued asset
-> Stellar Asset Contract
-> campaign escrow funded with AIDUSD
-> recipient trustline receives AIDUSD after verified claim
```

Commands:

```bash
pnpm stellar:asset:doctor:testnet
pnpm stellar:asset:setup-aidusd:testnet
pnpm stellar:fresh-aidusd-campaign:testnet
pnpm stellar:aidusd:active:testnet
pnpm stellar:smoke:aidusd:testnet
```

Status: AIDUSD live testnet setup, fresh compliance deployment, smoke validation, and browser compliance e2e are validated. `reports/AIDUSD_BLOCKER.md` records the resolved environment blocker. These scripts must not commit issuer, distributor, or recipient secret keys; they write only public addresses and contract IDs.

Fallback path:

```txt
native testnet XLM SAC
-> campaign escrow funded with native testnet XLM SAC value
-> recipient receives native testnet XLM SAC value after verified claim
```

Commands:

```bash
pnpm stellar:fresh-payout-campaign:testnet
pnpm stellar:payout:active:testnet
pnpm stellar:smoke:payout:testnet
```

The campaign exposes:

```txt
fund_campaign(from, amount)
get_escrow_balance()
```

`fund_campaign` requires funder auth before transferring asset value into campaign escrow. Claims check the configured budget, remaining budget, per-recipient cap, actual escrow token balance, nullifier, and verifier success before any payout transfer.

## Compliance Rejections

The real proof/campaign path rejects:

- wrong eligibility root,
- wrong compliance root,
- wrong policy hash,
- wrong campaign ID,
- wrong payout hash,
- over-cap amount,
- duplicate nullifier,
- invalid proof,
- eligible but non-compliant demo recipient,
- ineligible demo recipient.

The browser exposes negative scenario buttons for duplicate, non-compliant Eve, ineligible Mallory, and swapped payout address attempts. Rejected transactions may not persist on-chain events; UI rejected-attempt rows are session-local and must be labeled that way.

## Verification Commands

```bash
pnpm web:zk:prepare
pnpm zk:verify:compliance
pnpm contracts:test:compliance
pnpm stellar:smoke:compliance:testnet
pnpm stellar:smoke:aidusd:testnet
pnpm web:e2e:compliance:testnet
pnpm privacy:audit
```

`contracts:test:compliance` is currently mapped through the main contract test suite. `web:e2e:compliance:testnet` blocks if `deployments/active-testnet.json` predates `complianceRoot` or the current verifier key; it passed against the fresh AIDUSD deployment on July 2, 2026.

## Disclosures

- Trusted setup artifacts are deterministic development artifacts.
- Compliance roots are deterministic demo roots; no real KYC/sanctions provider is integrated.
- The relayer is local, testnet-only, and pays testnet fees.
- Freighter payout address binding is implemented; direct Freighter transaction signing is not implemented.
- Mock token code remains for local/demo compatibility, not the main real payout path.
- The system is unaudited and does not support mainnet.
