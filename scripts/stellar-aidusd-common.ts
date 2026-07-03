import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Asset, Networks } from "@stellar/stellar-sdk";
import {
  activeTestnetPath,
  invokeContract,
  readJson,
  repoRoot,
  requireCleanSourceAccount,
  run,
  writeJson
} from "./stellar-testnet-common";

export const AIDUSD_CODE = "AIDUSD";
export const aidusdDeploymentPath = join(repoRoot, "deployments", "aidusd-testnet.json");
export const aidusdBlockerPath = join(repoRoot, "reports", "AIDUSD_BLOCKER.md");

export type AidusdDeployment = {
  network: "testnet";
  assetCode: "AIDUSD";
  issuerKeyName: string;
  issuerPublicKey: string;
  distributorKeyName: string;
  distributorPublicKey: string;
  assetContractId: string;
  setupAt: string;
  notes: string;
};

export function assetString(issuerPublicKey: string): string {
  return `${AIDUSD_CODE}:${issuerPublicKey}`;
}

export function aidusdContractId(issuerPublicKey: string): string {
  return new Asset(AIDUSD_CODE, issuerPublicKey).contractId(Networks.TESTNET);
}

export function aidusdKeyNames() {
  return {
    issuer: process.env.STELLAR_AIDUSD_ISSUER_KEY?.trim() || "lumen-aidusd-issuer",
    distributor: requireCleanSourceAccount()
  };
}

export function parsePublicKey(output: string, label: string): string {
  const match = output.match(/\bG[A-Z2-7]{55}\b/);
  if (!match) {
    throw new Error(`Could not parse ${label} public key from Stellar CLI output.`);
  }
  return match[0];
}

export function parseContractId(output: string, label: string): string {
  const matches = output.match(/\bC[A-Z2-7]{55}\b/g);
  const contractId = matches?.at(-1);
  if (!contractId) {
    throw new Error(`Could not parse ${label} contract ID from Stellar CLI output.`);
  }
  return contractId;
}

export function getLocalKeyPublicKey(keyName: string): string | null {
  if (/^S[A-Z2-7]{55}$/.test(keyName)) {
    throw new Error(`Refusing secret-key shaped key name for ${keyName}`);
  }
  const result = run("stellar", ["keys", "public-key", keyName], {
    allowFailure: true,
    suppressCommand: true,
    suppressOutput: true
  });
  if (result.status !== 0) {
    return null;
  }
  return parsePublicKey(result.stdout, keyName);
}

export function ensureFundedKey(keyName: string): string {
  const existing = getLocalKeyPublicKey(keyName);
  if (existing) {
    run("stellar", ["keys", "fund", keyName, "--network", "testnet"], {
      allowFailure: true,
      suppressCommand: true,
      suppressOutput: true
    });
    return existing;
  }

  const generated = run("stellar", ["keys", "generate", keyName, "--fund", "--network", "testnet"], {
    suppressCommand: true,
    suppressOutput: true
  });
  if (generated.status !== 0) {
    throw new Error(`Could not generate funded testnet key ${keyName}`);
  }
  const publicKey = getLocalKeyPublicKey(keyName);
  if (!publicKey) {
    throw new Error(`Could not resolve generated testnet key ${keyName}`);
  }
  return publicKey;
}

export function changeTrust(keyName: string, issuerPublicKey: string): void {
  run("stellar", [
    "tx",
    "new",
    "change-trust",
    "--source-account",
    keyName,
    "--line",
    assetString(issuerPublicKey),
    "--network",
    "testnet"
  ]);
}

export function issueAsset(args: {
  issuerKeyName: string;
  issuerPublicKey: string;
  destinationPublicKey: string;
  amount: string;
}): void {
  run("stellar", [
    "tx",
    "new",
    "payment",
    "--source-account",
    args.issuerKeyName,
    "--destination",
    args.destinationPublicKey,
    "--asset",
    assetString(args.issuerPublicKey),
    "--amount",
    args.amount,
    "--network",
    "testnet"
  ]);
}

export function deployAidusdSac(sourceAccount: string, issuerPublicKey: string): string {
  const result = run(
    "stellar",
    [
      "contract",
      "asset",
      "deploy",
      "--asset",
      assetString(issuerPublicKey),
      "--source-account",
      sourceAccount,
      "--network",
      "testnet"
    ],
    { allowFailure: true, suppressOutput: true }
  );
  if (result.status !== 0) {
    const text = `${result.stdout}\n${result.stderr}`;
    if (text.includes("ExistingValue") || text.includes("contract already exists")) {
      return aidusdContractId(issuerPublicKey);
    }
    throw new Error(`AIDUSD SAC deployment failed: ${text.trim()}`);
  }
  return parseContractId(`${result.stdout}\n${result.stderr}`, "AIDUSD SAC");
}

export async function writeAidusdBlocker(reason: string): Promise<void> {
  await writeFile(
    aidusdBlockerPath,
    [
      "# AIDUSD Blocker",
      "",
      `Date: ${new Date().toISOString()}`,
      "",
      "AIDUSD/SAC setup did not complete. The native testnet XLM SAC payout path is preserved as the fallback validation path.",
      "",
      "## Reason",
      "",
      reason,
      ""
    ].join("\n"),
    "utf8"
  );
}

export async function readAidusdDeployment(): Promise<AidusdDeployment> {
  return readJson<AidusdDeployment>(aidusdDeploymentPath);
}

export async function writeAidusdDeployment(value: AidusdDeployment): Promise<void> {
  await writeJson(aidusdDeploymentPath, value);
}

export function readTokenBalance(args: {
  assetContractId: string;
  sourceAccount: string;
  id: string;
}): string {
  const result = invokeContract({
    contractId: args.assetContractId,
    sourceAccount: args.sourceAccount,
    fn: "balance",
    fnArgs: ["--id", args.id],
    send: "no",
    suppressOutput: true
  });
  const match = result.stdout.match(/-?\d+/);
  return match?.[0] ?? "0";
}

export async function readActiveAidusdCampaign() {
  return readJson(activeTestnetPath);
}
