import { loadTestnetEnv } from "./lib/load-env";
import { run } from "./stellar-testnet-common";

async function main(): Promise<void> {
  loadTestnetEnv({ requireSourceAccount: true, requireRelayerEnabled: true });
  run("pnpm", ["web:e2e:payout:testnet"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
