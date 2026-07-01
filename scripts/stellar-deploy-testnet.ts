import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const network = "testnet";
const wasmTarget = "wasm32v1-none";
const deploymentPath = join(repoRoot, "deployments", "testnet.json");

const contracts = {
  verifier: {
    label: "verifier",
    wasm: join(repoRoot, "target", wasmTarget, "release", "lumen_verifier.wasm")
  },
  mockToken: {
    label: "mock token",
    wasm: join(repoRoot, "target", wasmTarget, "release", "lumen_mock_token.wasm")
  },
  campaign: {
    label: "campaign",
    wasm: join(repoRoot, "target", wasmTarget, "release", "lumen_campaign.wasm")
  }
};

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface DeploymentFile {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
  deployerPublicKey: string;
  deployedAt: string;
  notes: string;
}

function run(command: string, args: string[], options: { suppressCommand?: boolean } = {}): CommandResult {
  if (!options.suppressCommand) {
    console.log(`$ ${[command, ...args].join(" ")}`);
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function requireCleanSourceAccount(): string {
  const sourceAccount = process.env.STELLAR_SOURCE_ACCOUNT?.trim();
  if (!sourceAccount) {
    throw new Error("STELLAR_SOURCE_ACCOUNT is required. Use a local Stellar CLI key name, not a private key.");
  }

  if (/^S[A-Z2-7]{55}$/.test(sourceAccount)) {
    throw new Error("Refusing to use a secret key in STELLAR_SOURCE_ACCOUNT. Use a local Stellar CLI key name.");
  }

  return sourceAccount;
}

function requireWasmArtifacts(): void {
  const missing = Object.values(contracts)
    .map((contract) => contract.wasm)
    .filter((path) => !existsSync(path));

  if (missing.length > 0) {
    throw new Error(`Missing WASM artifact(s):\n${missing.map((path) => `- ${path}`).join("\n")}`);
  }
}

function parseContractId(output: string, label: string): string {
  const matches = output.match(/\bC[A-Z2-7]{55}\b/g);
  const contractId = matches?.at(-1);
  if (!contractId) {
    throw new Error(`Could not parse ${label} contract ID from Stellar CLI output.`);
  }
  return contractId;
}

function parsePublicKey(output: string): string {
  const match = output.match(/\bG[A-Z2-7]{55}\b/);
  if (!match) {
    throw new Error("Could not parse deployer public key from Stellar CLI output.");
  }
  return match[0];
}

function deployContract(label: string, wasm: string, sourceAccount: string): string {
  const result = run("stellar", [
    "contract",
    "deploy",
    "--wasm",
    wasm,
    "--source-account",
    sourceAccount,
    "--network",
    network
  ]);

  if (result.status !== 0) {
    throw new Error(`${label} deployment failed`);
  }

  const contractId = parseContractId(`${result.stdout}\n${result.stderr}`, label);
  console.log(`[ok] ${label} contract id: ${contractId}`);
  return contractId;
}

async function writeDeployment(value: DeploymentFile): Promise<void> {
  await mkdir(dirname(deploymentPath), { recursive: true });
  await writeFile(deploymentPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  if (process.env.STELLAR_NETWORK && process.env.STELLAR_NETWORK !== network) {
    throw new Error(`Refusing to deploy to ${process.env.STELLAR_NETWORK}; this command only deploys to ${network}.`);
  }
  process.env.STELLAR_NETWORK = network;

  const doctor = run("pnpm", ["stellar:doctor"]);
  if (doctor.status !== 0) {
    throw new Error("Stellar deployment preflight failed");
  }

  const build = run("pnpm", ["contracts:build"]);
  if (build.status !== 0) {
    throw new Error("Contract WASM build failed");
  }
  requireWasmArtifacts();

  const publicKeyResult = run("stellar", ["keys", "public-key", sourceAccount], {
    suppressCommand: true
  });
  if (publicKeyResult.status !== 0) {
    throw new Error(`Could not resolve deployer public key for ${sourceAccount}`);
  }
  const deployerPublicKey = parsePublicKey(publicKeyResult.stdout);

  const verifierContractId = deployContract(
    contracts.verifier.label,
    contracts.verifier.wasm,
    sourceAccount
  );
  const mockTokenContractId = deployContract(
    contracts.mockToken.label,
    contracts.mockToken.wasm,
    sourceAccount
  );
  const campaignContractId = deployContract(
    contracts.campaign.label,
    contracts.campaign.wasm,
    sourceAccount
  );

  const deployment: DeploymentFile = {
    network,
    campaignContractId,
    verifierContractId,
    mockTokenContractId,
    deployerPublicKey,
    deployedAt: new Date().toISOString(),
    notes:
      process.env.STELLAR_DEPLOY_NOTES ??
      "Deployed current Lumen verifier, campaign, and mock token contracts to Stellar testnet. Verifier build uses the default real Groth16 path; dev_verifier feature was not enabled."
  };

  await writeDeployment(deployment);
  console.log(`[ok] wrote ${deploymentPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
