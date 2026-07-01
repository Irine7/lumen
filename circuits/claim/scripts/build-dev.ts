import { join } from "node:path";
import {
  buildDir,
  createProofPathDemo,
  ensureBuildDir,
  writeJson,
  writeProofPathArtifacts
} from "./common";
import { cleanBuildDir } from "./zk";

async function main(): Promise<void> {
  await cleanBuildDir();
  await ensureBuildDir();

  console.warn("");
  console.warn("============================================================");
  console.warn("WARNING: zk:build:dev is NOT compiling the Circom circuit.");
  console.warn("WARNING: this writes dev_verifier demo artifacts only.");
  console.warn("WARNING: use pnpm zk:build for real R1CS/WASM/zkey output.");
  console.warn("============================================================");
  console.warn("");

  const proofPath = await createProofPathDemo();
  await writeProofPathArtifacts(proofPath);
  await writeJson(join(buildDir, "build-status.dev.json"), {
    circuit: "circuits/claim/claim.circom",
    status: "dev_only_not_compiled",
    mode: "dev_verifier",
    warning:
      "This command intentionally skipped Circom compilation and did not create Groth16 artifacts."
  });

  console.log(`Dev-only proof path artifacts written to ${buildDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
