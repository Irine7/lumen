import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_TARGET = "wasm32v1-none";
const packages = [
  { name: "lumen_verifier", wasm: "lumen_verifier.wasm" },
  { name: "lumen_campaign", wasm: "lumen_campaign.wasm" },
  { name: "lumen_mock_token", wasm: "lumen_mock_token.wasm" }
];

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[]): CommandResult {
  const printable = [command, ...args].join(" ");
  console.log(`$ ${printable}`);

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

function hasInstalledTarget(target: string): boolean {
  const result = spawnSync("rustup", ["target", "list", "--installed"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  return result.status === 0 && (result.stdout ?? "").split(/\r?\n/).includes(target);
}

async function main(): Promise<void> {
  if (!hasInstalledTarget(WASM_TARGET)) {
    throw new Error(`Missing Rust target ${WASM_TARGET}. Install with: rustup target add ${WASM_TARGET}`);
  }

  for (const item of packages) {
    const result = run("cargo", [
      "build",
      "--locked",
      "--release",
      "--target",
      WASM_TARGET,
      "-p",
      item.name
    ]);
    if (result.status !== 0) {
      throw new Error(`Contract build failed for ${item.name}`);
    }
  }

  for (const item of packages) {
    const wasmPath = join(repoRoot, "target", WASM_TARGET, "release", item.wasm);
    if (!existsSync(wasmPath)) {
      throw new Error(`Expected WASM artifact missing: ${wasmPath}`);
    }
    console.log(`[ok] ${item.name}: ${wasmPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
