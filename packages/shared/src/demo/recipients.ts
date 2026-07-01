import type { DemoRecipient, Hex32 } from "../index";

const field = (hex: string): string => BigInt(hex).toString();

export const DEMO_POLICY_HASH =
  "0x1f0f1c8d9e2215a08b69345882c8850b778b85f0346f02c7c2a610f51d41aa21" as Hex32;

export const DEMO_CAMPAIGN_ID =
  "0x0026b8888700a5d67d4a5374656c6c61722d6169642d7261696c732d30303101" as Hex32;

export const DEMO_OPERATOR_ADDRESS =
  "GDEMOOPERATOR00000000000000000000000000000000000000000000000";

export const DEMO_ASSET_ADDRESS =
  "GDEMOUSDCASSET000000000000000000000000000000000000000000000";

export const DEMO_VERIFIER_ADDRESS =
  "GDEMOVERIFIER0000000000000000000000000000000000000000000000";

export const demoRecipients: DemoRecipient[] = [
  {
    id: "alice",
    displayName: "Alice",
    eligibilityReason: "Flood relief household grant",
    eligible: true,
    recipientSecret: field("0x2a8f3b91f84d5136ab4c099143f88842"),
    identityHash: field("0x19537e6f5a2b94d1652bb871490af020"),
    leafSalt: field("0x39f06d334e8b09c177f40576e9a3ab11"),
    amountSalt: field("0x0acdc0ffeefeed1234554321f00dd00d"),
    defaultClaimAmount: 125
  },
  {
    id: "bob",
    displayName: "Bob",
    eligibilityReason: "Emergency medical stipend",
    eligible: true,
    recipientSecret: field("0x0b0b51a7e7f1e1c3d792b1b1960ca11e"),
    identityHash: field("0x0bb0050fb0b9e501e5ca1ab1e0ff1ce0"),
    leafSalt: field("0x0f1ceab13f00d100000000000000b0b0"),
    amountSalt: field("0x0badc0ffee000000123456789abcdef0"),
    defaultClaimAmount: 175
  },
  {
    id: "mallory",
    displayName: "Mallory",
    eligibilityReason: "Not in campaign eligibility tree",
    eligible: false,
    recipientSecret: field("0x0d15a110wedbad0000000000000000001".replace("w", "")),
    identityHash: field("0x0bad1deacafef00d0000000000000002"),
    leafSalt: field("0x0bad5a17000000000000000000000003"),
    amountSalt: field("0x0badc1a1f00000000000000000000004"),
    defaultClaimAmount: 125
  }
];

export const demoCampaignSeed = {
  campaignId: DEMO_CAMPAIGN_ID,
  name: "Valencia Emergency Aid Pilot",
  operator: DEMO_OPERATOR_ADDRESS,
  asset: DEMO_ASSET_ADDRESS,
  budget: 1000,
  perRecipientCap: 250,
  denyRoot: null,
  policyHash: DEMO_POLICY_HASH,
  verifier: DEMO_VERIFIER_ADDRESS,
  startLedger: 1,
  endLedger: 999999,
  isActive: true
} as const;
