import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const buildDir = join(repoRoot, "circuits", "claim", "build");

function runPnpm(
  args: string[],
  options: { env?: Record<string, string>; timeoutMs?: number } = {}
) {
  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...options.env
    },
    encoding: "utf8",
    stdio: "pipe",
    shell: true,
    timeout: options.timeoutMs ?? 180_000,
    maxBuffer: 1024 * 1024 * 20
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("real ZK command pipeline", () => {
  it("zk:build fails when the required compiler is missing", () => {
    const result = runPnpm(["zk:build"], {
      env: {
        LUMEN_CIRCOM_PATH: join(buildDir, "definitely-missing-circom"),
        LUMEN_ZK_IGNORE_LOCAL_CIRCOM: "1",
        LUMEN_ZK_IGNORE_PATH_CIRCOM: "1"
      },
      timeoutMs: 30_000
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("circom");
  });

  beforeAll(() => {
    const build = runPnpm(["zk:build"], { timeoutMs: 240_000 });
    expect(`${build.stdout}\n${build.stderr}`).toContain(
      "ZK build completed with real Circom compilation"
    );
    expect(build.status).toBe(0);

    const prove = runPnpm(["zk:prove:demo"], { timeoutMs: 120_000 });
    expect(prove.status).toBe(0);
    expect(prove.stdout).toContain("Proof system: Groth16");
    expect(prove.stdout).toContain("Verifier mode: real_local");

    const verify = runPnpm(["zk:verify:local"], { timeoutMs: 120_000 });
    expect(verify.status).toBe(0);
    expect(verify.stdout).toContain("Verifier mode: real_local");
  }, 500_000);

  it("Alice proof verifies using the real local verifier", () => {
    const summary = readJson<{
      proofSystem: string;
      proofGenerated: boolean;
      localVerification: boolean;
      verifierMode: string;
    }>(join(buildDir, "proof-summary.json"));

    expect(summary.proofSystem).toBe("Groth16");
    expect(summary.proofGenerated).toBe(true);
    expect(summary.localVerification).toBe(true);
    expect(summary.verifierMode).toBe("real_local");
  });

  it("Mallory does not verify", () => {
    const report = readJson<{ results: Array<{ name: string; ok: boolean }> }>(
      join(buildDir, "verification-report.json")
    );

    expect(report.results.find((result) => result.name === "Mallory invalid claim fails")).toMatchObject({
      ok: true
    });
  });

  it("modified public input does not verify", () => {
    const report = readJson<{ results: Array<{ name: string; ok: boolean }> }>(
      join(buildDir, "verification-report.json")
    );

    expect(
      report.results.find((result) => result.name === "Modified public input does not verify")
    ).toMatchObject({ ok: true });
  });

  it("modified proof does not verify", () => {
    const report = readJson<{ results: Array<{ name: string; ok: boolean }> }>(
      join(buildDir, "verification-report.json")
    );

    expect(report.results.find((result) => result.name === "Modified proof does not verify")).toMatchObject({
      ok: true
    });
  });

  it("wrong eligibility root does not verify", () => {
    const report = readJson<{ results: Array<{ name: string; ok: boolean }> }>(
      join(buildDir, "verification-report.json")
    );

    expect(report.results.find((result) => result.name === "Wrong eligibility root fails")).toMatchObject({
      ok: true
    });
  });

  it("over-cap amount fails", () => {
    const report = readJson<{ results: Array<{ name: string; ok: boolean }> }>(
      join(buildDir, "verification-report.json")
    );

    expect(report.results.find((result) => result.name === "Over-cap amount fails")).toMatchObject({
      ok: true
    });
  });

  it("dev verifier is never used unless explicitly requested", () => {
    const summary = readJson<unknown>(join(buildDir, "proof-summary.json"));
    const report = readJson<unknown>(join(buildDir, "verification-report.json"));

    expect(JSON.stringify(summary)).not.toContain("dev_verifier");
    expect(JSON.stringify(report)).not.toContain("dev_verifier");
  });
});
