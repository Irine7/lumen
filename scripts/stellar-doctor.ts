import { spawnSync } from "node:child_process";
import { assertLocalStellarSourceAccount, loadEnvFiles } from "./lib/load-env";

loadEnvFiles();

try {
  assertLocalStellarSourceAccount();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const TESTNET_NETWORK = "testnet";
const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const WASM_TARGET = "wasm32v1-none";

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function check(ok: boolean, label: string, notes?: string): boolean {
  console.log(`${ok ? "[ok]" : "[fail]"} ${label}`);
  if (notes) {
    console.log(`  ${notes}`);
  }
  return ok;
}

function record(ok: boolean, failed: { value: boolean }): void {
  if (!ok) {
    failed.value = true;
  }
}

function hasInstalledTarget(target: string): boolean {
  const result = run("rustup", ["target", "list", "--installed"]);
  return result.status === 0 && result.stdout.split(/\r?\n/).includes(target);
}

async function main(): Promise<void> {
  const failed = { value: false };

  const stellar = run("stellar", ["--version"]);
  record(
    check(
      stellar.status === 0,
      stellar.status === 0 ? `stellar CLI ${stellar.stdout.trim()}` : "stellar CLI not found",
      stellar.status === 0
        ? undefined
        : "Install Stellar CLI before testnet deployment: https://developers.stellar.org/docs/tools/cli/stellar-cli"
    ),
    failed
  );

  const rustc = run("rustc", ["--version"]);
  record(
    check(
      rustc.status === 0,
      rustc.status === 0 ? rustc.stdout.trim() : "rustc not found",
      rustc.status === 0 ? undefined : "Install Rust with rustup before building contracts."
    ),
    failed
  );

  const cargo = run("cargo", ["--version"]);
  record(
    check(
      cargo.status === 0,
      cargo.status === 0 ? cargo.stdout.trim() : "cargo not found",
      cargo.status === 0 ? undefined : "Install Rust/Cargo with rustup before building contracts."
    ),
    failed
  );

  const wasmTargetInstalled = hasInstalledTarget(WASM_TARGET);
  record(
    check(
      wasmTargetInstalled,
      `${WASM_TARGET} target installed`,
      wasmTargetInstalled ? undefined : `Install with: rustup target add ${WASM_TARGET}`
    ),
    failed
  );

  const networkName = process.env.STELLAR_NETWORK;
  const networkOk = networkName === TESTNET_NETWORK;
  record(
    check(
      networkOk,
      "STELLAR_NETWORK=testnet",
      networkOk ? undefined : `Set STELLAR_NETWORK=${TESTNET_NETWORK} before deployment.`
    ),
    failed
  );

  if (stellar.status === 0) {
    const networks = run("stellar", ["network", "ls"]);
    const configured =
      networks.status === 0 &&
      networks.stdout.toLowerCase().split(/\s+/).includes(TESTNET_NETWORK);
    record(
      check(
        configured,
        "stellar CLI testnet network configured",
        configured
          ? undefined
          : `Configure with: stellar network add --global ${TESTNET_NETWORK} --rpc-url ${TESTNET_RPC_URL} --network-passphrase "${TESTNET_PASSPHRASE}"`
      ),
      failed
    );
  }

  const sourceAccount = process.env.STELLAR_SOURCE_ACCOUNT;
  const sourcePresent = Boolean(sourceAccount);
  record(
    check(
      sourcePresent,
      "STELLAR_SOURCE_ACCOUNT present",
      sourcePresent
        ? undefined
        : "Set STELLAR_SOURCE_ACCOUNT to a funded Stellar CLI key name, for example lumen-deployer."
    ),
    failed
  );

  if (stellar.status === 0 && sourceAccount) {
    const address = run("stellar", ["keys", "public-key", sourceAccount]);
    record(
      check(
        address.status === 0,
        `source account key available: ${sourceAccount}`,
        address.status === 0
          ? address.stdout.trim()
          : `Create and fund one with: stellar keys generate ${sourceAccount} --network ${TESTNET_NETWORK} --fund`
      ),
      failed
    );
  }

  if (failed.value) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
