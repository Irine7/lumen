import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildDemoComplianceTree,
  buildDemoEligibilityTree,
  createDemoCampaignConfig
} from "@lumen-aid/merkle";
import { assertLocalStellarSourceAccount, loadTestnetEnv } from "./lib/load-env";

loadTestnetEnv();

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const network = "testnet";
export const deploymentPath = join(repoRoot, "deployments", "testnet.json");
export const campaignStatePath = join(repoRoot, "deployments", "testnet-campaign.json");
export const campaignConfigArgPath = join(
  repoRoot,
  "deployments",
  "testnet-campaign-config.arg.json"
);
export const alicePublicInputsArgPath = join(
  repoRoot,
  "deployments",
  "testnet-alice-public-inputs.arg.json"
);
export const aliceClaimPath = join(repoRoot, "deployments", "testnet-alice-claim.json");
export const aliceDuplicateClaimPath = join(
  repoRoot,
  "deployments",
  "testnet-alice-duplicate-claim.json"
);
export const activeTestnetPath = join(repoRoot, "deployments", "active-testnet.json");
export const activeCampaignConfigArgPath = join(
  repoRoot,
  "deployments",
  "active-testnet-campaign-config.arg.json"
);

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface TestnetDeployment {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
  deployerPublicKey: string;
  deployedAt: string;
  notes: string;
}

export interface TestnetCampaignState {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
  campaignId: string;
  eligibilityRoot: string;
  complianceRoot: string;
  policyHash: string;
  operator: string;
  asset: string;
  budget: string;
  perRecipientCap: string;
  startLedger: number;
  endLedger: number;
  initializedAt: string;
  mode: "real_groth16_verifier";
  notes: string;
}

export interface ActiveTestnetDeployment {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId?: string;
  assetContractId?: string;
  assetMode?: "native_xlm_sac" | "aidusd_sac" | "mock_token";
  assetCode?: string;
  assetIssuer?: string;
  escrowFunded?: string;
  campaignId: string;
  eligibilityRoot: string;
  complianceRoot: string;
  policyHash: string;
  operator: string;
  asset: string;
  budget: string;
  perRecipientCap: string;
  startLedger: number;
  endLedger: number;
  createdAt: string;
  verifierInfo:
    | {
        mode: "real_groth16" | "dev_verifier";
        version: string;
        verifierId: string;
        circuitId: string;
        verificationKeyHash: string;
      }
    | {
        mode: "legacy_not_introspectable";
        notes: string;
      };
  recipients: {
    id: string;
    displayName: string;
    name?: string;
    eligible: boolean;
    compliant?: boolean;
    defaultClaimAmount: number;
    payoutAddress?: string;
    payoutAccountHash?: string;
  }[];
  notes: string;
}

export function run(
  command: string,
  args: string[],
  options: { allowFailure?: boolean; suppressCommand?: boolean; suppressOutput?: boolean } = {}
): CommandResult {
  if (!options.suppressCommand) {
    console.log(`$ ${[command, ...args].join(" ")}`);
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  if (result.stdout && !options.suppressOutput) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr && !options.suppressOutput) {
    process.stderr.write(result.stderr);
  }

  const status = result.status ?? 1;
  if (status !== 0 && !options.allowFailure) {
    throw new Error(`Command failed (${status}): ${[command, ...args].join(" ")}`);
  }

  return {
    status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function requireCleanSourceAccount(): string {
  const sourceAccount = assertLocalStellarSourceAccount();
  if (!sourceAccount) {
    throw new Error("STELLAR_SOURCE_ACCOUNT is required. Use a local Stellar CLI key name, not a private key.");
  }

  if (process.env.STELLAR_NETWORK && process.env.STELLAR_NETWORK !== network) {
    throw new Error(`Refusing to use STELLAR_NETWORK=${process.env.STELLAR_NETWORK}; expected ${network}.`);
  }

  process.env.STELLAR_NETWORK = network;
  return sourceAccount;
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readDeployment(): Promise<TestnetDeployment> {
  if (!existsSync(deploymentPath)) {
    throw new Error(`Missing ${deploymentPath}. Run pnpm stellar:deploy:testnet first.`);
  }
  const deployment = await readJson<TestnetDeployment>(deploymentPath);
  if (deployment.network !== network) {
    throw new Error(`Expected testnet deployment, found ${deployment.network}`);
  }
  return deployment;
}

export function strip0x(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

export function demoCampaignValues(deployment: TestnetDeployment, operator: string) {
  const tree = buildDemoEligibilityTree();
  const complianceTree = buildDemoComplianceTree();
  const campaign = createDemoCampaignConfig(tree, complianceTree);
  const startLedger = 1;
  const endLedger = 4_294_967_295;

  return {
    campaign,
    config: {
      asset: deployment.mockTokenContractId,
      budget: String(campaign.budget),
      campaign_id: strip0x(campaign.campaignId),
      compliance_root: strip0x(campaign.complianceRoot),
      deny_root: null,
      eligibility_root: strip0x(campaign.eligibilityRoot),
      end_ledger: endLedger,
      is_active: true,
      operator,
      per_recipient_cap: String(campaign.perRecipientCap),
      policy_hash: strip0x(campaign.policyHash),
      start_ledger: startLedger,
      verifier: deployment.verifierContractId
    },
    startLedger,
    endLedger
  };
}

export function claimPublicInputsFromNamedInputs(publicInputs: {
  campaignId: string;
  eligibilityRoot: string;
  complianceRoot: string;
  policyHash: string;
  nullifierHash: string;
  amountCommitment: string;
  recipientCommitment: string;
  payoutAccountHash: string;
  amount: number;
  maxAmount: number;
}) {
  return {
    amount: String(publicInputs.amount),
    amount_commitment: strip0x(publicInputs.amountCommitment),
    campaign_id: strip0x(publicInputs.campaignId),
    compliance_root: strip0x(publicInputs.complianceRoot),
    eligibility_root: strip0x(publicInputs.eligibilityRoot),
    max_amount: String(publicInputs.maxAmount),
    nullifier_hash: strip0x(publicInputs.nullifierHash),
    payout_account_hash: strip0x(publicInputs.payoutAccountHash),
    policy_hash: strip0x(publicInputs.policyHash),
    recipient_commitment: strip0x(publicInputs.recipientCommitment)
  };
}

function fieldToHex(value: string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

export async function aliceProofHex(): Promise<string> {
  const proofPath = join(repoRoot, "circuits", "claim", "build", "alice-proof.json");
  if (!existsSync(proofPath)) {
    throw new Error("Missing Alice proof artifact. Run pnpm zk:prove:demo first.");
  }

  const proof = await readJson<{
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
  }>(proofPath);

  return [
    proof.pi_a[0],
    proof.pi_a[1],
    proof.pi_b[0][1],
    proof.pi_b[0][0],
    proof.pi_b[1][1],
    proof.pi_b[1][0],
    proof.pi_c[0],
    proof.pi_c[1]
  ]
    .map(fieldToHex)
    .join("");
}

export async function alicePublicInputs() {
  const path = join(repoRoot, "circuits", "claim", "build", "alice-public-inputs.json");
  if (!existsSync(path)) {
    throw new Error("Missing Alice public input artifact. Run pnpm zk:prove:demo first.");
  }
  return readJson<{
    campaignId: string;
    eligibilityRoot: string;
    complianceRoot: string;
    policyHash: string;
    nullifierHash: string;
    amountCommitment: string;
    recipientCommitment: string;
    payoutAccountHash: string;
    amount: number;
    maxAmount: number;
  }>(path);
}

export function invokeContract(args: {
  contractId: string;
  sourceAccount: string;
  fn: string;
  fnArgs?: string[];
  allowFailure?: boolean;
  send?: "default" | "yes" | "no";
  suppressOutput?: boolean;
}): CommandResult {
  const invokeArgs = [
    "contract",
    "invoke",
    "--id",
    args.contractId,
    "--source-account",
    args.sourceAccount,
    "--network",
    network
  ];
  if (args.send && args.send !== "default") {
    invokeArgs.push("--send", args.send);
  }
  invokeArgs.push("--", args.fn, ...(args.fnArgs ?? []));

  return run("stellar", invokeArgs, {
    allowFailure: args.allowFailure,
    suppressOutput: args.suppressOutput
  });
}

export function outputContainsContractError(result: CommandResult, code: number): boolean {
  const text = `${result.stdout}\n${result.stderr}`;
  return text.includes(`Error(Contract, #${code})`) || text.includes(`"code":${code}`);
}
