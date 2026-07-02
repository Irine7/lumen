import { rm } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./stellar-testnet-common";

const publicZkDir = join(repoRoot, "apps", "web", "public", "zk");
const generatedFiles = [
  "claim.wasm",
  "claim_final.zkey",
  "verification_key.json",
  "zk-manifest.json"
];

async function main(): Promise<void> {
  for (const filename of generatedFiles) {
    const path = join(publicZkDir, filename);
    await rm(path, { force: true });
    console.log(`[ok] removed ${path}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

