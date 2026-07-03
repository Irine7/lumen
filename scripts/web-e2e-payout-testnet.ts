import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loadTestnetEnv } from "./lib/load-env";
import type { ActiveTestnetDeployment } from "./stellar-testnet-common";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activePath = join(repoRoot, "deployments", "active-testnet.json");
const defaultRpcUrl = "https://soroban-testnet.stellar.org";

function openPort(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findOpenPort(): Promise<number> {
  for (let port = 3150; port < 3200; port += 1) {
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
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1_000));
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

async function waitForProofReady(page: Page): Promise<void> {
  const deadline = Date.now() + 300_000;
  let lastText = "";
  while (Date.now() < deadline) {
    lastText = await page.locator("main").innerText({ timeout: 10_000 });
    const verificationStatus = await page.getByTestId("local-verification-status").innerText({
      timeout: 10_000
    });
    if (/real Groth16 accepted/i.test(verificationStatus)) {
      return;
    }
    if (
      /Proof status: failed|Real testnet claim failed|Choose a valid Stellar payout address|Freighter is not available/i.test(
        lastText
      )
    ) {
      throw new Error(`Proof generation failed in UI:\n${lastText}`);
    }
    await page.waitForTimeout(1_000);
  }

  throw new Error(`Timed out waiting for proof readiness. Last visible text:\n${lastText}`);
}

async function main(): Promise<void> {
  loadTestnetEnv({ requireSourceAccount: true, requireRelayerEnabled: true });

  if (!existsSync(activePath)) {
    throw new Error(
      "Missing deployments/active-testnet.json. Run pnpm stellar:fresh-payout-campaign:testnet."
    );
  }
  const active = JSON.parse(await readFile(activePath, "utf8")) as ActiveTestnetDeployment;
  if (active.network !== "testnet") {
    throw new Error("Active deployment is not testnet");
  }
  if (!active.complianceRoot) {
    throw new Error(
      "Active deployment is missing complianceRoot. Deploy a fresh compliance campaign before running browser compliance e2e."
    );
  }
  if (active.verifierInfo.mode !== "real_groth16") {
    throw new Error(`web:e2e:payout:testnet requires real_groth16 verifier, found ${active.verifierInfo.mode}`);
  }
  if (!active.assetContractId) {
    throw new Error("web:e2e:payout:testnet requires active.assetContractId");
  }

  const sourceAccount = process.env.STELLAR_SOURCE_ACCOUNT!;

  const port = await findOpenPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_RPC_URL:
      process.env.NEXT_PUBLIC_RPC_URL || defaultRpcUrl,
    NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID: active.campaignContractId,
    NEXT_PUBLIC_VERIFIER_CONTRACT_ID: active.verifierContractId,
    NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID: active.mockTokenContractId ?? active.assetContractId,
    LUMEN_TESTNET_RELAYER_ENABLED: "true",
    STELLAR_NETWORK: "testnet",
    STELLAR_SOURCE_ACCOUNT: sourceAccount
  };

  const server = spawn(
    "pnpm",
    [
      "--filter",
      "@lumen-aid/web",
      "exec",
      "next",
      "dev",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1"
    ],
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
    page.setDefaultTimeout(240_000);

    await page.goto(baseUrl);
    await expect(page.getByText("Testnet connected")).toBeVisible();
    await expect(page.getByText(/Prove compliance clearance privately/i)).toBeVisible();
    await expect(page.getByText(/Receive AIDUSD testnet payout after Soroban verification/i)).toBeVisible();

    await page.goto(`${baseUrl}/demo`);
    await expect(page.getByTestId("demo-command-center")).toBeVisible();

    await page.goto(`${baseUrl}/donor`);
    await expect(page.getByText("Campaign accountability")).toBeVisible();
    await expect(page.getByText(active.campaignContractId)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("donor-escrow-balance")).toBeVisible();
    await expect(page.getByText(/AIDUSD/i).first()).toBeVisible();
    await expect(page.getByText(/Compliance root/i).first()).toBeVisible();
    await expect(page.getByText(/Verifier mode: real_groth16/i).first()).toBeVisible();
    await expect(page.getByTestId("donor-total-distributed")).toBeVisible();
    await expect(page.getByText(/Remaining budget/i).first()).toBeVisible();

    await page.goto(`${baseUrl}/recipient`);
    await expect(page.getByTestId("recipient-real-testnet-mode")).toBeVisible();
    await page.getByRole("button", { name: /Use demo recipient address/i }).click();
    await expect(page.getByText(/Proof bound to recipient/i)).toBeVisible();
    await page.getByTestId("generate-proof-button").click();
    await waitForProofReady(page);
    await expect(page.getByTestId("local-verification-status")).toContainText(/real Groth16 accepted/i);

    await page.getByTestId("submit-claim-button").click();
    await expect(page.getByTestId("claim-result-status")).toContainText(/claim accepted/i, {
      timeout: 240_000
    });
    await expect(page.getByText(/Tx hash/i)).toBeVisible();
    await expect(page.getByText(/Recipient balance/i)).toBeVisible();
    await expect(page.getByText(/Escrow balance/i)).toBeVisible();

    await page.getByTestId("duplicate-claim-button").click();
    await expect(page.getByTestId("claim-result-status")).toContainText(/duplicate/i, {
      timeout: 240_000
    });

    await page.goto(`${baseUrl}/donor`);
    await page.getByTestId("donor-refresh-button").click();
    await expect(page.getByTestId("donor-total-distributed")).toBeVisible();
    await expect(page.getByText(/Last payout|Last browser testnet tx/i).first()).toBeVisible();

    await page.goto(`${baseUrl}/recipient`);
    await page.getByTestId("eve-negative-button").click();
    await page.getByTestId("generate-proof-button").click();
    await expect(page.getByText(/Recipient is not included in the active compliance clearance tree/i)).toBeVisible({
      timeout: 120_000
    });

    await page.getByTestId("mallory-negative-button").click();
    await page.getByTestId("generate-proof-button").click();
    await expect(page.getByText(/Recipient is not included in the active eligibility tree/i)).toBeVisible({
      timeout: 120_000
    });

    await page.goto(`${baseUrl}/auditor`);
    await expect(page.getByText(/Auditor disclosure/i)).toBeVisible();
    await expect(page.getByTestId("auditor-package-status")).toContainText(/Demo-only selective disclosure/i);
    await expect(page.getByRole("heading", { name: /Auditor selective view/i })).toBeVisible();
    await expect(page.getByText(/Audit commitment/i)).toBeVisible();
    await expect(page.getByText(/Dora/i).first()).toBeVisible();
    await expect(page.getByText(/cleared/i).first()).toBeVisible();

    console.log("✅ Landing shows real testnet payout flow enabled");
    console.log("✅ Landing shows compliance/AIDUSD testnet mode");
    console.log("✅ Donor shows escrow funded");
    console.log("✅ Donor shows AIDUSD asset and compliance root");
    console.log("✅ Dora browser proof bound to payout address");
    console.log("✅ Browser local verification passed");
    console.log("✅ Dora payout claim submitted to testnet");
    console.log("✅ Tx hash and balance panels shown");
    console.log("✅ Donor dashboard refresh checked");
    console.log("✅ Duplicate payout claim rejected");
    console.log("✅ Eve non-compliant attempt rejected");
    console.log("✅ Mallory rejected before submission");
    console.log("✅ Auditor selective disclosure package shown");
  } finally {
    await browser?.close();
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
