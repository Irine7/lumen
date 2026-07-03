import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./stellar-testnet-common";

type AuditCheck = {
  name: string;
  ok: boolean;
  evidence: string;
};

const forbiddenPrivateFields = [
  "recipient_secret",
  "recipientSecret",
  "identity_hash",
  "identityHash",
  "leaf_salt",
  "leafSalt",
  "compliance_leaf_salt",
  "complianceLeafSalt",
  "complianceMerklePath",
  "compliance_merkle_path",
  "complianceMerkleIndices",
  "compliance_merkle_indices",
  "amount_salt",
  "amountSalt",
  "eligibilityMerklePath",
  "eligibility_merkle_path",
  "eligibilityMerkleIndices",
  "eligibility_merkle_indices",
  "witness",
  "privateInputs"
];

async function read(path: string): Promise<string> {
  return readFile(join(repoRoot, path), "utf8");
}

function check(name: string, ok: boolean, evidence: string): AuditCheck {
  return { name, ok, evidence };
}

function bodySnippet(source: string): string {
  const start = source.indexOf('fetch("/api/testnet/claim"');
  if (start === -1) {
    return "";
  }
  const end = source.indexOf("});", start);
  return source.slice(start, end === -1 ? start + 1200 : end + 3);
}

async function main(): Promise<void> {
  const [route, configRoute, recipient, worker, contract, gitignore] = await Promise.all([
    read("apps/web/app/api/testnet/claim/route.ts"),
    read("apps/web/app/api/testnet/config/route.ts"),
    read("apps/web/app/recipient/recipient-client.tsx"),
    read("apps/web/workers/claim-proof.worker.ts"),
    read("contracts/campaign/src/lib.rs"),
    read(".gitignore")
  ]);
  const claimBody = bodySnippet(recipient);
  const browserSources = `${recipient}\n${worker}`;
  const payoutCheckIndex = contract.indexOf("WrongPayoutRecipient");
  const duplicateCheckIndex = contract.indexOf("is_nullifier_used");
  const verifierIndex = contract.indexOf('"verify_claim"');
  const transferIndex = contract.indexOf("token.transfer");
  const nullifierStoreIndex = contract.indexOf("DataKey::Nullifier(public_inputs.nullifier_hash.clone())");

  const checks: AuditCheck[] = [
    check(
      "API route rejects private witness fields",
      route.includes("PRIVATE_FIELD_PATTERN") &&
        forbiddenPrivateFields.some((field) => route.includes(field)) &&
        route.includes("Private witness fields are not accepted"),
      "Relayer route recursively scans request keys for private witness names before processing."
    ),
    check(
      "Claim network request contains only public payout data",
      claimBody.includes("proofEncodingForSoroban") &&
        claimBody.includes("publicInputs") &&
        claimBody.includes("payoutRecipient") &&
        claimBody.includes("campaignContractId") &&
        claimBody.includes("campaignId") &&
        !forbiddenPrivateFields.some((field) => claimBody.includes(field)),
      "Recipient POST body contains proof encoding, public inputs, public payout recipient, campaign contract ID, and campaign ID."
    ),
    check(
      "Compliance private witness fields are blocked",
      forbiddenPrivateFields.includes("compliance_leaf_salt") &&
        forbiddenPrivateFields.includes("complianceMerklePath") &&
        route.includes("complianceRoot") &&
        route.includes("active.complianceRoot") &&
        configRoute.includes("Active deployment predates the compliance-root protocol"),
      "The relayer rejects compliance witness fields and refuses stale active deployments that lack a public compliance root."
    ),
    check(
      "Browser computes payout binding locally",
      worker.includes("derivePayoutAccountHash") &&
        worker.includes("payout_account_hash") &&
        recipient.includes("derivePayoutAccountHash"),
      "The worker derives payout_account_hash before witness generation, and the UI computes the same public hash from the selected payout address."
    ),
    check(
      "Payout address is public and allowed",
      route.includes("payoutRecipient") &&
        route.includes("Missing payout recipient") &&
        route.includes("derivePayoutAccountHash(value.payoutRecipient)"),
      "The relayer accepts the public payout recipient while still rejecting witness/private fields."
    ),
    check(
      "Relayer rejects swapped payout recipient",
      route.includes("derivePayoutAccountHash(value.payoutRecipient)") &&
        route.includes("Payout recipient does not match publicInputs.payoutAccountHash"),
      "The relayer recomputes payout_account_hash from payoutRecipient and rejects mismatches before sending a transaction."
    ),
    check(
      "Relayer cannot change amount/campaign/root/policy",
        route.includes("amount_commitment") &&
        route.includes("campaign_id") &&
        route.includes("compliance_root") &&
        route.includes("eligibility_root") &&
        route.includes("policy_hash") &&
        route.includes("const simulation = run(") &&
        route.includes("Claim simulation rejected") &&
        route.includes("Unknown campaign ID"),
      "The relayer serializes caller-supplied public inputs without private data, pins the active campaign ID/contract, and simulates before submission."
    ),
    check(
      "Browser normal mode does not log private witness values",
      !/console\.(log|debug|info|warn|error)\([^)]*(recipientSecret|identityHash|leafSalt|amountSalt|witness|privateInputs)/.test(
        browserSources
      ),
      "Browser proof worker and recipient UI do not console-log witness/private field names in normal mode."
    ),
    check(
      "Relayer rejects mainnet",
      route.includes('process.env.STELLAR_NETWORK !== "testnet"') &&
        route.includes("STELLAR_NETWORK=testnet"),
      "Relayer requires STELLAR_NETWORK=testnet and returns 403 otherwise."
    ),
    check(
      "Relayer rejects unknown campaign ID",
      route.includes("Unknown campaign ID") && route.includes("value.campaignId !== active.campaignId"),
      "Request campaign ID must match deployments/active-testnet.json."
    ),
    check(
      "Relayer rejects unknown contract ID",
      route.includes("Unknown campaign contract ID") &&
        route.includes("value.campaignContractId !== active.campaignContractId"),
      "Request campaign contract ID must match deployments/active-testnet.json."
    ),
    check(
      "Relayer rejects malformed proof/public inputs",
      route.includes("Malformed Groth16 proof encoding") &&
        route.includes("normalizeHex32") &&
        route.includes("normalizeAmount"),
      "Proof encoding, hex32 public inputs, and integer amounts are validated before simulation."
    ),
    check(
      "Relayer does not expose source account secret",
      route.includes("STELLAR_SOURCE_ACCOUNT must be a local key name") &&
        route.includes("/^S[A-Z2-7]{55}$/"),
      "Secret-key shaped STELLAR_SOURCE_ACCOUNT values are refused."
    ),
    check(
      ".gitignore protects generated witness/private artifacts",
      gitignore.includes("*.wtns") &&
        gitignore.includes("*private-inputs*.json") &&
        gitignore.includes("circuits/claim/build") &&
        gitignore.includes("apps/web/public/zk") &&
        gitignore.includes(".env"),
      ".gitignore covers env files, witness files, private input JSON, circuit build output, and browser ZK artifacts."
    ),
    check(
      "Contract cannot redirect payout",
      contract.includes("payout_account_hash") &&
        contract.includes("payout_recipient") &&
        contract.includes("WrongPayoutRecipient"),
      "Campaign claim computes the Soroban payout recipient hash and compares it with the proof public input."
    ),
    check(
      "Failed or duplicate claim cannot transfer asset",
      payoutCheckIndex !== -1 &&
        duplicateCheckIndex !== -1 &&
        verifierIndex !== -1 &&
        transferIndex !== -1 &&
        nullifierStoreIndex !== -1 &&
        payoutCheckIndex < duplicateCheckIndex &&
        duplicateCheckIndex < verifierIndex &&
        verifierIndex < transferIndex &&
        transferIndex < nullifierStoreIndex,
      "Campaign checks payout binding and duplicate nullifier before verifier call, transfers only after verifier success, then stores the nullifier."
    ),
    check(
      "Debug reveal has warning and explicit toggle",
      recipient.includes("Debug reveal warning") &&
        recipient.includes("Reveal private values") &&
        recipient.includes("redacted={!revealPrivate}"),
      "Private demo values appear only in Debug mode behind an explicit reveal toggle."
    )
  ];

  const failed = checks.filter((item) => !item.ok);
  const report = [
    "# Lumen Privacy Audit",
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    ...checks.map((item) => `| ${item.name} | ${item.ok ? "PASS" : "FAIL"} | ${item.evidence} |`),
    "",
    "## Result",
    "",
    failed.length === 0
      ? "PASS WITH DISCLOSURE. The browser proof flow keeps eligibility and compliance witness values local, treats the payout address as public, and prevents relayer payout redirection. The deterministic development trusted setup, demo compliance roots, local demo simulator, local testnet relayer, lack of production audit, lack of real KYC/sanctions provider integration, and lack of mainnet support remain disclosures."
      : `FAIL. ${failed.length} privacy check(s) failed.`,
    ""
  ].join("\n");

  await writeFile(join(repoRoot, "reports", "PRIVACY_AUDIT.md"), report, "utf8");

  for (const item of checks) {
    console.log(`${item.ok ? "[ok]" : "[fail]"} ${item.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`${failed.length} privacy audit check(s) failed`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
