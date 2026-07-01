import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  circomInstallDir,
  circomSourceDir,
  circomTag,
  localCircomPath,
  resolveCircom,
  runCommand,
  toolsDir
} from "./zk";

function requireHostTool(command: string): void {
  const result = runCommand(
    { command, args: ["--version"], shell: true },
    { allowFailure: true }
  );
  if (result.status !== 0) {
    throw new Error(`${command} is required for pnpm zk:setup`);
  }
}

async function main(): Promise<void> {
  await mkdir(toolsDir, { recursive: true });

  if (existsSync(localCircomPath)) {
    const circom = await resolveCircom();
    console.log(`Project-local circom already installed at ${localCircomPath}`);
    if (circom.version) {
      console.log(circom.version);
    }
    return;
  }

  requireHostTool("git");
  requireHostTool("cargo");

  if (!existsSync(circomSourceDir)) {
    runCommand({
      command: "git",
      args: [
        "clone",
        "--depth",
        "1",
        "--branch",
        circomTag,
        "https://github.com/iden3/circom.git",
        circomSourceDir
      ],
      shell: true
    });
  } else {
    runCommand({
      command: "git",
      args: ["-C", circomSourceDir, "fetch", "--depth", "1", "origin", `tag`, circomTag],
      shell: true
    });
    runCommand({
      command: "git",
      args: ["-C", circomSourceDir, "checkout", "--detach", circomTag],
      shell: true
    });
  }

  runCommand({
    command: "cargo",
    args: [
      "install",
      "--locked",
      "--path",
      `${circomSourceDir}/circom`,
      "--root",
      circomInstallDir,
      "--force"
    ],
    shell: true
  });

  if (!existsSync(localCircomPath)) {
    throw new Error(`Circom install finished but binary was not found at ${localCircomPath}`);
  }

  console.log(`Installed Circom ${circomTag} at ${localCircomPath}`);
  console.log("No compiler binaries should be committed; .tools/ is ignored.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
