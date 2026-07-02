import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { artifactPaths } from "../circuits/claim/scripts/zk";
import { repoRoot } from "./stellar-testnet-common";

const publicZkDir = join(repoRoot, "apps", "web", "public", "zk");
const outputs = [
  {
    source: artifactPaths.wasm,
    filename: "claim.wasm"
  },
  {
    source: artifactPaths.zkeyFinal,
    filename: "claim_final.zkey"
  },
  {
    source: artifactPaths.verificationKey,
    filename: "verification_key.json"
  }
];

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  const missing = outputs.map((item) => item.source).filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      `Missing real ZK build artifact(s):\n${missing.map((path) => `- ${path}`).join("\n")}\nRun pnpm zk:build.`
    );
  }

  await mkdir(publicZkDir, { recursive: true });

  const artifactHashes: Record<string, string> = {};
  for (const item of outputs) {
    const destination = join(publicZkDir, item.filename);
    await copyFile(item.source, destination);
    artifactHashes[item.filename] = await sha256(destination);
    console.log(`[ok] copied public ZK artifact: ${destination}`);
  }

  const manifest = {
    circuit: "claim_v0",
    proofSystem: "groth16",
    curve: "bn128",
    wasmPath: "/zk/claim.wasm",
    zkeyPath: "/zk/claim_final.zkey",
    verificationKeyPath: "/zk/verification_key.json",
    setup: "deterministic-development",
    artifactHashes
  };

  const manifestPath = join(publicZkDir, "zk-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[ok] wrote ${manifestPath}`);
  console.log("[ok] private witness files, private input JSON, recipient secrets, and Merkle path fixtures were not copied");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

