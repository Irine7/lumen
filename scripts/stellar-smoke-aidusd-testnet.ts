import { run } from "./stellar-testnet-common";

async function main(): Promise<void> {
  run("pnpm", ["stellar:aidusd:active:testnet"]);
  run("pnpm", ["stellar:smoke:payout:testnet"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
