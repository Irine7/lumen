import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CampaignConfig,
  ClaimPrivateInputs,
  ClaimPublicInputs,
  DemoRecipient,
  Hex32,
  MerkleProof
} from "@lumen-aid/shared";
import { demoRecipients } from "@lumen-aid/shared";
import {
  buildDemoEligibilityTree,
  createDemoCampaignConfig,
  derivePublicInputs,
  getMerkleProofForRecipient,
  toFieldString,
  type DemoEligibilityTree
} from "@lumen-aid/merkle";

const here = dirname(fileURLToPath(import.meta.url));

export const claimDir = resolve(here, "..");
export const repoRoot = resolve(claimDir, "..", "..");
export const buildDir = join(claimDir, "build");
export const toolsDir = join(repoRoot, ".tools");
export const circomSourceDir = join(toolsDir, "circom-src");
export const circomInstallDir = join(toolsDir, "circom");
export const circomTag = "v2.2.3";

const exe = process.platform === "win32" ? ".exe" : "";
export const localCircomPath = join(circomInstallDir, "bin", `circom${exe}`);
export const claimCircuitPath = join(claimDir, "claim.circom");
export const snarkjsCliPath = join(repoRoot, "node_modules", "snarkjs", "build", "cli.cjs");

export const artifactPaths = {
  r1cs: join(buildDir, "claim.r1cs"),
  sym: join(buildDir, "claim.sym"),
  wasm: join(buildDir, "claim_js", "claim.wasm"),
  witnessGenerator: join(buildDir, "claim_js", "generate_witness.js"),
  pot0: join(buildDir, "pot12_0000.ptau"),
  pot1: join(buildDir, "pot12_0001.ptau"),
  potBeacon: join(buildDir, "pot12_beacon.ptau"),
  potFinal: join(buildDir, "pot12_final.ptau"),
  zkey0: join(buildDir, "claim_0000.zkey"),
  zkeyFinal: join(buildDir, "claim_final.zkey"),
  verificationKey: join(buildDir, "verification_key.json"),
  aliceInput: join(buildDir, "alice-input.json"),
  aliceWitness: join(buildDir, "alice-witness.wtns"),
  aliceProof: join(buildDir, "alice-proof.json"),
  alicePublic: join(buildDir, "alice-public.json"),
  aliceNamedPublic: join(buildDir, "alice-public-inputs.json"),
  alicePrivateDebug: join(buildDir, "alice-private-inputs.debug.json"),
  proof: join(buildDir, "proof.json"),
  public: join(buildDir, "public.json"),
  proofSummary: join(buildDir, "proof-summary.json"),
  verificationReport: join(buildDir, "verification-report.json"),
  buildStatus: join(buildDir, "build-status.json")
};

export const requiredBuildArtifacts = [
  artifactPaths.r1cs,
  artifactPaths.sym,
  artifactPaths.wasm,
  artifactPaths.witnessGenerator,
  artifactPaths.potFinal,
  artifactPaths.zkeyFinal,
  artifactPaths.verificationKey
];

export interface CommandSpec {
  command: string;
  args: string[];
  shell?: boolean;
}

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface ResolvedTool {
  ok: boolean;
  command?: string;
  argsPrefix?: string[];
  version?: string;
  reason?: string;
}

export interface DemoCircuitCase {
  tree: DemoEligibilityTree;
  campaign: CampaignConfig;
  recipient: DemoRecipient;
  merkleProof: MerkleProof | null;
  publicInputs: ClaimPublicInputs;
  privateInputs?: ClaimPrivateInputs;
  circuitInputs?: Record<string, string | string[] | number[]>;
}

export interface VerificationCaseResult {
  name: string;
  expected: boolean;
  actual: boolean;
  ok: boolean;
  detail: string;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureBuildDir(): Promise<void> {
  await mkdir(buildDir, { recursive: true });
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function cleanBuildDir(): Promise<void> {
  const resolvedBuildDir = resolve(buildDir);
  const resolvedClaimDir = resolve(claimDir);

  if (!resolvedBuildDir.startsWith(resolvedClaimDir)) {
    throw new Error(`Refusing to clean outside claim circuit directory: ${resolvedBuildDir}`);
  }

  await rm(resolvedBuildDir, { recursive: true, force: true });
}

export function runCommand(
  spec: CommandSpec,
  options: {
    cwd?: string;
    label?: string;
    allowFailure?: boolean;
    suppressOutput?: boolean;
  } = {}
): CommandResult {
  const printable = [spec.command, ...spec.args].join(" ");
  if (options.label) {
    console.log(options.label);
  }
  console.log(`$ ${printable}`);

  const result = spawnSync(spec.command, spec.args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: spec.shell ?? false,
    stdio: "pipe"
  }) as SpawnSyncReturns<string>;

  if (result.stdout && !options.suppressOutput) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr && !options.suppressOutput) {
    process.stderr.write(result.stderr);
  }

  const status = result.status ?? 1;
  if (status !== 0 && !options.allowFailure) {
    throw new Error(`Command failed (${status}): ${printable}`);
  }

  return {
    status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function commandWorks(command: string, args: string[], shell = false): CommandResult | null {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell,
    stdio: "pipe"
  }) as SpawnSyncReturns<string>;

  if (result.error || result.status !== 0) {
    return null;
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export async function resolveCircom(): Promise<ResolvedTool> {
  const configuredPath = process.env.LUMEN_CIRCOM_PATH;
  if (configuredPath) {
    if (existsSync(configuredPath)) {
      const version = commandWorks(configuredPath, ["--version"])?.stdout.trim();
      return { ok: true, command: configuredPath, argsPrefix: [], version };
    }

    return {
      ok: false,
      reason: `LUMEN_CIRCOM_PATH is set but does not exist: ${configuredPath}`
    };
  }

  if (process.env.LUMEN_ZK_IGNORE_LOCAL_CIRCOM !== "1" && existsSync(localCircomPath)) {
    const version = commandWorks(localCircomPath, ["--version"])?.stdout.trim();
    return { ok: true, command: localCircomPath, argsPrefix: [], version };
  }

  if (process.env.LUMEN_ZK_IGNORE_PATH_CIRCOM !== "1") {
    const result = commandWorks("circom", ["--version"], true);
    if (result) {
      return {
        ok: true,
        command: "circom",
        argsPrefix: [],
        version: result.stdout.trim()
      };
    }
  }

  return {
    ok: false,
    reason:
      "circom was not found. Run `pnpm zk:setup` for a project-local install, or install Circom 2.x and put `circom` on PATH."
  };
}

export async function requireCircom(): Promise<CommandSpec> {
  const circom = await resolveCircom();
  if (!circom.ok || !circom.command) {
    throw new Error(`${circom.reason}\nInstall instructions: pnpm zk:setup`);
  }

  return {
    command: circom.command,
    args: [],
    shell: circom.command === "circom"
  };
}

export async function resolveSnarkjs(): Promise<ResolvedTool> {
  if (!(await pathExists(snarkjsCliPath))) {
    return {
      ok: false,
      reason: "snarkjs CLI was not found in node_modules. Run `pnpm install`."
    };
  }

  const packagePath = join(repoRoot, "node_modules", "snarkjs", "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as { version?: string };

  return {
    ok: true,
    command: process.execPath,
    argsPrefix: [snarkjsCliPath],
    version: packageJson.version
  };
}

export async function requireSnarkjs(): Promise<CommandSpec> {
  const snarkjs = await resolveSnarkjs();
  if (!snarkjs.ok || !snarkjs.command || !snarkjs.argsPrefix) {
    throw new Error(snarkjs.reason);
  }

  return {
    command: snarkjs.command,
    args: snarkjs.argsPrefix
  };
}

export async function snarkjsArgs(args: string[]): Promise<CommandSpec> {
  const snarkjs = await requireSnarkjs();
  return {
    command: snarkjs.command,
    args: [...snarkjs.args, ...args]
  };
}

export function nodeArgs(args: string[]): CommandSpec {
  return {
    command: process.execPath,
    args
  };
}

export function field(value: string | number): string {
  return toFieldString(value);
}

export function publicSignalsFromInputs(publicInputs: ClaimPublicInputs): string[] {
  return [
    field(publicInputs.campaignId),
    field(publicInputs.eligibilityRoot),
    field(publicInputs.policyHash),
    field(publicInputs.nullifierHash),
    publicInputs.amount.toString(),
    publicInputs.maxAmount.toString(),
    field(publicInputs.amountCommitment),
    field(publicInputs.recipientCommitment)
  ];
}

export function formatCircuitInputs(
  privateInputs: ClaimPrivateInputs,
  publicInputs: ClaimPublicInputs
): Record<string, string | string[] | number[]> {
  return {
    recipient_secret: field(privateInputs.recipientSecret),
    identity_hash: field(privateInputs.identityHash),
    leaf_salt: field(privateInputs.leafSalt),
    eligibility_merkle_path: privateInputs.eligibilityMerklePath.map((item) =>
      field(item)
    ),
    eligibility_merkle_indices: privateInputs.eligibilityMerkleIndices,
    amount_salt: field(privateInputs.amountSalt),
    campaign_id: field(publicInputs.campaignId),
    eligibility_root: field(publicInputs.eligibilityRoot),
    policy_hash: field(publicInputs.policyHash),
    nullifier_hash: field(publicInputs.nullifierHash),
    amount: publicInputs.amount.toString(),
    max_amount: publicInputs.maxAmount.toString(),
    amount_commitment: field(publicInputs.amountCommitment),
    recipient_commitment: field(publicInputs.recipientCommitment)
  };
}

export function createDemoCircuitCase(options: {
  recipientId: DemoRecipient["id"];
  amount?: number;
  recipients?: DemoRecipient[];
  campaignOverride?: Partial<CampaignConfig>;
  merkleProofOverride?: MerkleProof | null;
}): DemoCircuitCase {
  const recipients = options.recipients ?? demoRecipients;
  const tree = buildDemoEligibilityTree(recipients);
  const campaign = {
    ...createDemoCampaignConfig(tree),
    ...options.campaignOverride
  };
  const recipient = recipients.find((item) => item.id === options.recipientId);

  if (!recipient) {
    throw new Error(`Missing demo recipient: ${options.recipientId}`);
  }

  const merkleProof =
    options.merkleProofOverride === undefined
      ? getMerkleProofForRecipient(tree, recipient)
      : options.merkleProofOverride;
  const publicInputs = derivePublicInputs({
    campaign,
    recipient,
    amount: options.amount ?? recipient.defaultClaimAmount
  });

  if (!merkleProof) {
    return {
      tree,
      campaign,
      recipient,
      merkleProof,
      publicInputs
    };
  }

  const privateInputs: ClaimPrivateInputs = {
    recipientSecret: recipient.recipientSecret,
    identityHash: recipient.identityHash,
    leafSalt: recipient.leafSalt,
    eligibilityMerklePath: merkleProof.path,
    eligibilityMerkleIndices: merkleProof.indices,
    amountSalt: recipient.amountSalt,
    eligibilityReason: recipient.eligibilityReason
  };

  return {
    tree,
    campaign,
    recipient,
    merkleProof,
    publicInputs,
    privateInputs,
    circuitInputs: formatCircuitInputs(privateInputs, publicInputs)
  };
}

export function createMalloryWithAlicePathCase(): DemoCircuitCase {
  const alice = createDemoCircuitCase({ recipientId: "alice" });
  if (!alice.merkleProof) {
    throw new Error("Alice Merkle proof is missing");
  }

  return createDemoCircuitCase({
    recipientId: "mallory",
    merkleProofOverride: alice.merkleProof
  });
}

export function assertCircuitInputs(
  demoCase: DemoCircuitCase
): asserts demoCase is DemoCircuitCase & {
  privateInputs: ClaimPrivateInputs;
  circuitInputs: Record<string, string | string[] | number[]>;
} {
  if (!demoCase.privateInputs || !demoCase.circuitInputs) {
    throw new Error(`${demoCase.recipient.id} does not have circuit inputs`);
  }
}

export function assertBuildArtifactsPresent(): void {
  const missing = requiredBuildArtifacts.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      `Missing ZK build artifacts:\n${missing.map((path) => `- ${path}`).join("\n")}\nRun pnpm zk:build.`
    );
  }
}

export function tamperPublicSignals(
  publicSignals: string[],
  index: number,
  replacement = "1"
): string[] {
  const next = [...publicSignals];
  next[index] = next[index] === replacement ? "2" : replacement;
  return next;
}

export async function writeDemoMetadata(demoCase: DemoCircuitCase): Promise<void> {
  await writeJson(join(buildDir, "eligibility-tree.json"), {
    root: demoCase.tree.root,
    leaves: demoCase.tree.leaves,
    layers: demoCase.tree.layers,
    eligibleRecipients: demoCase.tree.eligibleRecipients.map((recipient) => ({
      id: recipient.id,
      displayName: recipient.displayName
    }))
  });
  await writeJson(join(buildDir, "demo-campaign.json"), demoCase.campaign);
}
