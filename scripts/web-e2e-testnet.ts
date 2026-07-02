import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import type { ActiveTestnetDeployment } from "./stellar-testnet-common";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activePath = join(repoRoot, "deployments", "active-testnet.json");
const defaultRpcUrl = "https://soroban-testnet.stellar.org";

function parseDotenvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const index = trimmed.indexOf("=");
  if (index === -1) {
    return null;
  }

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

async function loadRootEnv(): Promise<Record<string, string>> {
  const envPath = join(repoRoot, ".env");
  if (!existsSync(envPath)) {
    return {};
  }

  const entries: Record<string, string> = {};
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseDotenvLine(line);
    if (parsed) {
      entries[parsed[0]] = parsed[1];
    }
  }
  return entries;
}

function openPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findOpenPort(): Promise<number> {
  for (let port = 3100; port < 3150; port += 1) {
    if (await openPort(port)) {
      return port;
    }
  }
  throw new Error("Could not find an open local port for Next.js");
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js dev server exited with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Timed out waiting for Next.js dev server");
}

function stopServer(child: ChildProcess): void {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore"
    });
    return;
  }

  child.kill("SIGTERM");
}

async function main(): Promise<void> {
  if (!existsSync(activePath)) {
    throw new Error("Missing deployments/active-testnet.json. Run pnpm stellar:fresh-campaign:testnet.");
  }
  const active = JSON.parse(await readFile(activePath, "utf8")) as ActiveTestnetDeployment;
  if (active.network !== "testnet") {
    throw new Error("Active deployment is not testnet");
  }
  if (active.verifierInfo.mode !== "real_groth16") {
    throw new Error(`web:e2e:testnet requires real_groth16 verifier, found ${active.verifierInfo.mode}`);
  }

  const rootEnv = await loadRootEnv();
  const sourceAccount =
    process.env.STELLAR_SOURCE_ACCOUNT ?? rootEnv.STELLAR_SOURCE_ACCOUNT ?? "admin";
  if (/^S[A-Z2-7]{55}$/.test(sourceAccount)) {
    throw new Error("Refusing to start relayer with a secret key in STELLAR_SOURCE_ACCOUNT");
  }

  const port = await findOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    ...rootEnv,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_RPC_URL:
      process.env.NEXT_PUBLIC_RPC_URL ?? rootEnv.NEXT_PUBLIC_RPC_URL ?? defaultRpcUrl,
    NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID: active.campaignContractId,
    NEXT_PUBLIC_VERIFIER_CONTRACT_ID: active.verifierContractId,
    NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID: active.mockTokenContractId,
    LUMEN_TESTNET_RELAYER_ENABLED: "true",
    STELLAR_NETWORK: "testnet",
    STELLAR_SOURCE_ACCOUNT: sourceAccount
  };

  const server = spawn(
    "pnpm",
    ["--filter", "@lumen-aid/web", "exec", "next", "dev", "--port", String(port), "--hostname", "127.0.0.1"],
    {
      cwd: repoRoot,
      env,
      shell: true,
      stdio: "pipe"
    }
  );

  server.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  let browser;
  try {
    await waitForServer(baseUrl, server);
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(180_000);

    await page.goto(baseUrl);
    await expect(page.getByText("Testnet connected")).toBeVisible();

    await page.goto(`${baseUrl}/donor`);
    await expect(page.getByText("Campaign accountability")).toBeVisible();
    await expect(page.getByText(active.campaignContractId)).toBeVisible({ timeout: 60_000 });

    await page.goto(`${baseUrl}/recipient`);
    await expect(page.getByRole("button", { name: /Real Testnet Claim/i })).toBeVisible();
    await page.getByRole("button", { name: /Dora/i }).click();
    await page.getByRole("button", { name: /Generate real browser ZK proof/i }).click();
    await expect(page.getByText(/Proof status: ready to submit/i)).toBeVisible({
      timeout: 240_000
    });
    await expect(page.getByText(/real Groth16 accepted/i)).toBeVisible();

    await page.getByRole("button", { name: /Submit proof to Stellar testnet/i }).click();
    await expect(page.getByText("Claim accepted on Stellar testnet")).toBeVisible({
      timeout: 180_000
    });
    await expect(page.getByText(/tx:/i)).toBeVisible();

    await page.goto(`${baseUrl}/donor`);
    await page.getByRole("button", { name: /Refresh/i }).click();
    await expect(page.getByText(/Total claimed/i)).toBeVisible();

    await page.goto(`${baseUrl}/recipient`);
    await page.getByRole("button", { name: /Dora/i }).click();
    await page.getByRole("button", { name: /Generate real browser ZK proof/i }).click();
    await expect(page.getByText(/Proof status: ready to submit/i)).toBeVisible({
      timeout: 240_000
    });
    await page.getByRole("button", { name: /Submit proof to Stellar testnet/i }).click();
    await expect(page.getByText(/duplicate/i)).toBeVisible({ timeout: 180_000 });

    await page.getByRole("button", { name: /Mallory/i }).click();
    await page.getByRole("button", { name: /Generate real browser ZK proof/i }).click();
    await expect(page.getByText(/Recipient is not included in the active eligibility tree/i)).toBeVisible({
      timeout: 120_000
    });

    console.log("✅ Landing shows testnet connected");
    console.log("✅ Donor loads real testnet state");
    console.log("✅ Dora browser proof generated");
    console.log("✅ Dora browser local verification passed");
    console.log("✅ Dora claim submitted through relayer");
    console.log("✅ Donor stats refresh checked");
    console.log("✅ Duplicate Dora claim rejected");
    console.log("✅ Mallory fails before submission");
  } finally {
    await browser?.close();
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
