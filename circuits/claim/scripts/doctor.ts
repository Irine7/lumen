import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  artifactPaths,
  claimCircuitPath,
  circomTag,
  localCircomPath,
  requiredBuildArtifacts,
  resolveCircom,
  resolveSnarkjs
} from "./zk";

function pnpmVersion(): string | null {
  const result = spawnSync("pnpm", ["--version"], {
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  return result.status === 0 ? result.stdout.trim() : null;
}

function line(ok: boolean, message: string): void {
  console.log(`${ok ? "✅" : "❌"} ${message}`);
}

async function main(): Promise<void> {
  let hardFailure = false;

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const nodeOk = nodeMajor >= 20;
  line(nodeOk, `Node ${process.version}${nodeOk ? "" : " (Node 20+ required)"}`);
  hardFailure ||= !nodeOk;

  const pnpm = pnpmVersion();
  line(Boolean(pnpm), pnpm ? `pnpm ${pnpm}` : "pnpm not found");
  hardFailure ||= !pnpm;

  const circom = await resolveCircom();
  line(
    circom.ok,
    circom.ok
      ? `circom found${circom.version ? ` (${circom.version})` : ""}`
      : "circom not found"
  );
  if (!circom.ok) {
    console.log(`Install instructions: pnpm zk:setup`);
    console.log(
      `Manual install: build Circom ${circomTag} from https://github.com/iden3/circom, or set LUMEN_CIRCOM_PATH.`
    );
    console.log(`Expected local path: ${localCircomPath}`);
  }

  const snarkjs = await resolveSnarkjs();
  line(
    snarkjs.ok,
    snarkjs.ok
      ? `snarkjs found${snarkjs.version ? ` (${snarkjs.version})` : ""}`
      : "snarkjs not found"
  );
  if (!snarkjs.ok) {
    console.log("Install instructions: pnpm install");
  }
  hardFailure ||= !snarkjs.ok;

  const circuitFound = existsSync(claimCircuitPath);
  line(circuitFound, circuitFound ? "claim.circom found" : "claim.circom missing");
  hardFailure ||= !circuitFound;

  const missingArtifacts = requiredBuildArtifacts.filter((path) => !existsSync(path));
  line(
    missingArtifacts.length === 0,
    missingArtifacts.length === 0
      ? "build artifacts present"
      : "build artifacts missing or incomplete"
  );
  if (missingArtifacts.length > 0) {
    for (const path of missingArtifacts) {
      console.log(`  missing: ${path}`);
    }
    console.log("  Build instructions: pnpm zk:build");
  }

  const proofArtifactsPresent =
    existsSync(artifactPaths.aliceProof) && existsSync(artifactPaths.alicePublic);
  line(
    proofArtifactsPresent,
    proofArtifactsPresent ? "demo proof artifacts present" : "demo proof artifacts missing"
  );
  if (!proofArtifactsPresent) {
    console.log("  Proof instructions: pnpm zk:prove:demo");
  }

  if (hardFailure) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
