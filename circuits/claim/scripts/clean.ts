import { buildDir, cleanBuildDir } from "./zk";

async function main(): Promise<void> {
  await cleanBuildDir();
  console.log(`Removed generated ZK artifacts from ${buildDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
