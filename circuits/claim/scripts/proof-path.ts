import { runCommand } from "./zk";

async function main(): Promise<void> {
  console.log("zk:proof:path now runs the real Groth16 demo proof path.");
  console.log("For the explicit dev-only path, use pnpm zk:build:dev.");
  runCommand({ command: "pnpm", args: ["zk:prove:demo"], shell: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
