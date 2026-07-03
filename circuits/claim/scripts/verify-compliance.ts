import { runCommand } from "./zk";

runCommand({ command: "pnpm", args: ["zk:verify:local"], shell: true });
