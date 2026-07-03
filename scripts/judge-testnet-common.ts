import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  activeTestnetPath,
  invokeContract,
  readJson,
  repoRoot,
  strip0x,
  writeJson,
  type ActiveTestnetDeployment
} from "./stellar-testnet-common";

export const latestReportsDir = join(repoRoot, "reports", "latest");
export const demoTestnetPath = join(repoRoot, "deployments", "demo-testnet.json");

export type ContractStats = {
  total_claimed: string;
  claim_count: number;
  remaining_budget: string;
  duplicate_claims_blocked: number;
  invalid_claims_blocked: number;
};

export type VerifierInfo = {
  verifier_id: string;
  circuit_id: string;
  verification_key_hash: string;
  mode: "real_groth16" | "dev_verifier";
  version: string;
};

export type ReleaseCommandResult = {
  command: string;
  status: "PASS" | "FAIL";
  notes: string;
};

export function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }
  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

export function parseInteger(stdout: string, label: string): string {
  const match = stdout.match(/-?\d+/);
  if (!match) {
    throw new Error(`Could not parse integer from ${label}`);
  }
  return match[0];
}

export function assetContractId(active: ActiveTestnetDeployment): string {
  const id = active.assetContractId ?? active.mockTokenContractId;
  if (!id) {
    throw new Error("Active campaign is missing an asset contract ID");
  }
  return id;
}

export function verificationKeyHash(active: ActiveTestnetDeployment): string {
  return active.verifierInfo.mode === "legacy_not_introspectable"
    ? "legacy verifier, mode not introspectable"
    : active.verifierInfo.verificationKeyHash;
}

export async function readActiveDeployment(): Promise<ActiveTestnetDeployment> {
  return readJson<ActiveTestnetDeployment>(activeTestnetPath);
}

export function readStats(
  active: ActiveTestnetDeployment,
  sourceAccount: string
): ContractStats {
  const result = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_stats",
    send: "no",
    suppressOutput: true
  });
  return parseJson<ContractStats>(result.stdout, "get_stats");
}

export function readEscrow(
  active: ActiveTestnetDeployment,
  sourceAccount: string
): string {
  const result = invokeContract({
    contractId: active.campaignContractId,
    sourceAccount,
    fn: "get_escrow_balance",
    send: "no",
    suppressOutput: true
  });
  return parseInteger(result.stdout, "get_escrow_balance");
}

export function readVerifierInfo(
  active: ActiveTestnetDeployment,
  sourceAccount: string
): VerifierInfo {
  const result = invokeContract({
    contractId: active.verifierContractId,
    sourceAccount,
    fn: "verifier_info",
    send: "no",
    suppressOutput: true
  });
  return parseJson<VerifierInfo>(result.stdout, "verifier_info");
}

export function isNullifierUsed(args: {
  active: ActiveTestnetDeployment;
  sourceAccount: string;
  nullifierHash: string;
}): boolean {
  const result = invokeContract({
    contractId: args.active.campaignContractId,
    sourceAccount: args.sourceAccount,
    fn: "is_nullifier_used",
    fnArgs: ["--nullifier_hash", strip0x(args.nullifierHash)],
    send: "no",
    suppressOutput: true
  });
  return /\btrue\b/.test(result.stdout);
}

export function campaignOverride(active: ActiveTestnetDeployment) {
  return {
    campaignId: active.campaignId,
    eligibilityRoot: active.eligibilityRoot,
    complianceRoot: active.complianceRoot,
    policyHash: active.policyHash,
    operator: active.operator,
    asset: assetContractId(active),
    verifier: active.verifierContractId,
    budget: Number(active.budget),
    perRecipientCap: Number(active.perRecipientCap),
    startLedger: active.startLedger,
    endLedger: active.endLedger,
    isActive: true
  };
}

export function classifyCampaignState(stats: ContractStats, escrowBalance: string):
  | "pristine"
  | "partially used"
  | "consumed" {
  if (stats.claim_count === 0) {
    return "pristine";
  }
  if (BigInt(stats.remaining_budget) <= 0n || BigInt(escrowBalance) <= 0n) {
    return "consumed";
  }
  return "partially used";
}

export async function writeMarkdownReport(path: string, lines: string[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

export async function writeDemoDeployment(value: unknown): Promise<void> {
  await writeJson(demoTestnetPath, value);
}

export function commandTable(results: ReleaseCommandResult[]): string[] {
  return [
    "| Command | Status | Notes |",
    "| --- | --- | --- |",
    ...results.map((result) => `| \`${result.command}\` | ${result.status} | ${result.notes} |`)
  ];
}

export function publicDeploymentRows(active: ActiveTestnetDeployment, escrowBalance: string): string[] {
  return [
    "| Field | Value |",
    "| --- | --- |",
    `| Network | \`${active.network}\` |`,
    `| Asset mode | \`${active.assetMode ?? "unknown"}\` |`,
    `| Asset code | \`${active.assetCode ?? "unknown"}\` |`,
    `| AIDUSD/SAC contract | \`${assetContractId(active)}\` |`,
    `| Campaign contract | \`${active.campaignContractId}\` |`,
    `| Verifier contract | \`${active.verifierContractId}\` |`,
    `| Campaign ID | \`${active.campaignId}\` |`,
    `| Eligibility root | \`${active.eligibilityRoot}\` |`,
    `| Compliance root | \`${active.complianceRoot}\` |`,
    `| Policy hash | \`${active.policyHash}\` |`,
    `| VK hash | \`${verificationKeyHash(active)}\` |`,
    `| Escrow funded | \`${active.escrowFunded ?? "unread"}\` |`,
    `| Escrow balance | \`${escrowBalance}\` |`
  ];
}
