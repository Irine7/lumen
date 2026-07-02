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
  "amount_salt",
  "amountSalt",
  "eligibilityMerklePath",
  "eligibility_merkle_path",
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
  const [route, recipient, worker, gitignore] = await Promise.all([
    read("apps/web/app/api/testnet/claim/route.ts"),
    read("apps/web/app/recipient/recipient-client.tsx"),
    read("apps/web/workers/claim-proof.worker.ts"),
    read(".gitignore")
  ]);
  const claimBody = bodySnippet(recipient);
  const browserSources = `${recipient}\n${worker}`;

  const checks: AuditCheck[] = [
    check(
      "API route rejects private witness fields",
      route.includes("PRIVATE_FIELD_PATTERN") &&
        forbiddenPrivateFields.some((field) => route.includes(field)) &&
        route.includes("Private witness fields are not accepted"),
      "Relayer route recursively scans request keys for private witness names before processing."
    ),
    check(
      "Claim network request contains only public data",
      claimBody.includes("proofEncodingForSoroban") &&
        claimBody.includes("publicInputs") &&
        claimBody.includes("campaignContractId") &&
        claimBody.includes("campaignId") &&
        !forbiddenPrivateFields.some((field) => claimBody.includes(field)),
      "Recipient POST body is limited to proof encoding, public inputs, campaign contract ID, and campaign ID."
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
      ? "PASS WITH DISCLOSURE. The browser proof flow keeps witness values local and the relayer accepts only proof/public input payloads. The deterministic development trusted setup and mock token remain disclosures."
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

