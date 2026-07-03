import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const testnetNetwork = "testnet";

export function loadEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(repoRoot, name);
    if (existsSync(path)) {
      loadDotenv({ path, override: false, quiet: true });
    }
  }
}

export function assertLocalStellarSourceAccount(value = process.env.STELLAR_SOURCE_ACCOUNT): string | undefined {
  const sourceAccount = value?.trim();
  if (!sourceAccount) {
    return undefined;
  }

  if (sourceAccount.startsWith("S")) {
    throw new Error("STELLAR_SOURCE_ACCOUNT must be a local Stellar CLI key name, not a secret key.");
  }

  if (sourceAccount.startsWith("G")) {
    throw new Error("STELLAR_SOURCE_ACCOUNT must be a local Stellar CLI key name, not a public address.");
  }

  return sourceAccount;
}

export function loadTestnetEnv(options: {
  requireSourceAccount?: boolean;
  requireRelayerEnabled?: boolean;
} = {}): void {
  loadEnvFiles();

  if (process.env.STELLAR_NETWORK !== testnetNetwork) {
    throw new Error("STELLAR_NETWORK must be testnet for these scripts.");
  }

  const sourceAccount = assertLocalStellarSourceAccount();
  if (options.requireSourceAccount && !sourceAccount) {
    throw new Error("STELLAR_SOURCE_ACCOUNT is required. Use a local Stellar CLI key name, not a private key.");
  }

  if (
    options.requireRelayerEnabled &&
    process.env.LUMEN_TESTNET_RELAYER_ENABLED !== "true"
  ) {
    throw new Error("LUMEN_TESTNET_RELAYER_ENABLED=true is required for relayer/e2e scripts.");
  }
}
