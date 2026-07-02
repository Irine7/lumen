import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import type { ClaimPublicInputs } from "@lumen-aid/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActiveDeployment = {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
  campaignId: string;
  eligibilityRoot: string;
  policyHash: string;
  perRecipientCap: string;
};

type ClaimRequestBody = {
  proofEncodingForSoroban: string;
  publicInputs: ClaimPublicInputs;
  campaignContractId: string;
  campaignId: string;
};

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const PRIVATE_FIELD_PATTERN =
  /recipient_secret|recipientSecret|identity_hash|identityHash|leaf_salt|leafSalt|amount_salt|amountSalt|merkle|witness|private/i;

function findRepoRoot(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(current, "deployments"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return resolve(process.cwd(), "..", "..");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, status: "rejected", message }, { status });
}

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

function checkRateLimit(request: NextRequest): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const recent = (rateLimit.get(key) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimit.set(key, recent);
    return false;
  }

  recent.push(now);
  rateLimit.set(key, recent);
  return true;
}

function containsPrivateField(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_FIELD_PATTERN.test(key)) {
      return true;
    }
    if (containsPrivateField(child)) {
      return true;
    }
  }

  return false;
}

function normalizeHex32(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be 32-byte hex`);
  }
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(`${label} must be 32-byte hex`);
  }
  return clean.toLowerCase();
}

function normalizeAmount(value: unknown, label: string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return String(parsed);
}

function validateBody(body: unknown, active: ActiveDeployment): ClaimRequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be an object");
  }
  if (containsPrivateField(body)) {
    throw new Error("Private witness fields are not accepted by the testnet relayer");
  }

  const value = body as Partial<ClaimRequestBody>;
  if (value.campaignContractId !== active.campaignContractId) {
    throw new Error("Unknown campaign contract ID");
  }
  if (value.campaignId !== active.campaignId) {
    throw new Error("Unknown campaign ID");
  }
  if (
    typeof value.proofEncodingForSoroban !== "string" ||
    !/^[0-9a-fA-F]{512}$/.test(value.proofEncodingForSoroban)
  ) {
    throw new Error("Malformed Groth16 proof encoding");
  }
  if (!value.publicInputs || typeof value.publicInputs !== "object") {
    throw new Error("Missing public inputs");
  }

  normalizeHex32(value.publicInputs.campaignId, "publicInputs.campaignId");
  normalizeHex32(value.publicInputs.eligibilityRoot, "publicInputs.eligibilityRoot");
  normalizeHex32(value.publicInputs.policyHash, "publicInputs.policyHash");
  normalizeHex32(value.publicInputs.nullifierHash, "publicInputs.nullifierHash");
  normalizeHex32(value.publicInputs.amountCommitment, "publicInputs.amountCommitment");
  normalizeHex32(value.publicInputs.recipientCommitment, "publicInputs.recipientCommitment");
  normalizeAmount(value.publicInputs.amount, "publicInputs.amount");
  normalizeAmount(value.publicInputs.maxAmount, "publicInputs.maxAmount");

  if (normalizeHex32(value.publicInputs.campaignId, "campaignId") !== normalizeHex32(active.campaignId, "active campaignId")) {
    throw new Error("Public inputs do not match active campaign ID");
  }
  if (
    normalizeHex32(value.publicInputs.eligibilityRoot, "eligibilityRoot") !==
    normalizeHex32(active.eligibilityRoot, "active eligibilityRoot")
  ) {
    throw new Error("Public inputs do not match active eligibility root");
  }
  if (normalizeHex32(value.publicInputs.policyHash, "policyHash") !== normalizeHex32(active.policyHash, "active policyHash")) {
    throw new Error("Public inputs do not match active policy hash");
  }
  if (String(value.publicInputs.maxAmount) !== active.perRecipientCap) {
    throw new Error("Public inputs do not match active per-recipient cap");
  }

  return value as ClaimRequestBody;
}

function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: true,
    stdio: "pipe"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function parseJson<T>(stdout: string, label: string): T {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not parse JSON from ${label}`);
  }
  return JSON.parse(stdout.slice(start, end + 1)) as T;
}

function contractErrorStatus(result: CommandResult): {
  status: string;
  message: string;
} {
  const text = `${result.stdout}\n${result.stderr}`;
  if (text.includes("Error(Contract, #10)") || text.includes('"code":10')) {
    return {
      status: "duplicate_rejected",
      message: "Duplicate nullifier rejected by the campaign contract"
    };
  }
  if (text.includes("Error(Contract, #5)") || text.includes('"code":5')) {
    return { status: "wrong_root_rejected", message: "Wrong eligibility root rejected" };
  }
  if (text.includes("Error(Contract, #6)") || text.includes('"code":6')) {
    return { status: "wrong_policy_rejected", message: "Wrong policy hash rejected" };
  }
  if (text.includes("Error(Contract, #8)") || text.includes('"code":8')) {
    return { status: "over_cap_rejected", message: "Over-cap amount rejected" };
  }
  if (text.includes("Error(Contract, #11)") || text.includes('"code":11')) {
    return { status: "invalid_rejected", message: "Invalid proof rejected" };
  }
  return { status: "simulation_rejected", message: "Claim simulation rejected" };
}

function parseTxHash(result: CommandResult): string | null {
  const text = `${result.stdout}\n${result.stderr}`;
  const labeled = text.match(/(?:transaction hash|tx hash|hash):\s*([0-9a-fA-F]{64})/i);
  if (labeled) {
    return labeled[1]!.toLowerCase();
  }
  const any = text.match(/\b[0-9a-fA-F]{64}\b/);
  return any?.[0].toLowerCase() ?? null;
}

async function readActive(repoRoot: string): Promise<ActiveDeployment> {
  const activePath = join(repoRoot, "deployments", "active-testnet.json");
  if (!existsSync(activePath)) {
    throw new Error("Missing deployments/active-testnet.json");
  }
  const active = JSON.parse(await readFile(activePath, "utf8")) as ActiveDeployment;
  if (active.network !== "testnet") {
    throw new Error("Active deployment is not testnet");
  }
  return active;
}

function publicInputsArg(publicInputs: ClaimPublicInputs) {
  return {
    amount: normalizeAmount(publicInputs.amount, "amount"),
    amount_commitment: normalizeHex32(publicInputs.amountCommitment, "amount_commitment"),
    campaign_id: normalizeHex32(publicInputs.campaignId, "campaign_id"),
    eligibility_root: normalizeHex32(publicInputs.eligibilityRoot, "eligibility_root"),
    max_amount: normalizeAmount(publicInputs.maxAmount, "max_amount"),
    nullifier_hash: normalizeHex32(publicInputs.nullifierHash, "nullifier_hash"),
    policy_hash: normalizeHex32(publicInputs.policyHash, "policy_hash"),
    recipient_commitment: normalizeHex32(publicInputs.recipientCommitment, "recipient_commitment")
  };
}

function invokeArgs(args: {
  active: ActiveDeployment;
  sourceAccount: string;
  publicInputsPath: string;
  proof: string;
  send?: "no";
}): string[] {
  const cliArgs = [
    "contract",
    "invoke",
    "--id",
    args.active.campaignContractId,
    "--source-account",
    args.sourceAccount,
    "--network",
    "testnet"
  ];
  if (args.send === "no") {
    cliArgs.push("--send", "no");
  }
  cliArgs.push(
    "--",
    "claim",
    "--public_inputs-file-path",
    args.publicInputsPath,
    "--proof",
    args.proof
  );
  return cliArgs;
}

function readStats(repoRoot: string, active: ActiveDeployment, sourceAccount: string) {
  const result = run(
    "stellar",
    [
      "contract",
      "invoke",
      "--id",
      active.campaignContractId,
      "--source-account",
      sourceAccount,
      "--network",
      "testnet",
      "--send",
      "no",
      "--",
      "get_stats"
    ],
    repoRoot
  );
  if (result.status !== 0) {
    return null;
  }
  return parseJson(result.stdout, "get_stats");
}

export async function POST(request: NextRequest) {
  if (process.env.LUMEN_TESTNET_RELAYER_ENABLED !== "true") {
    return jsonError("Testnet relayer is disabled", 403);
  }
  if (process.env.STELLAR_NETWORK !== "testnet") {
    return jsonError("Testnet relayer requires STELLAR_NETWORK=testnet", 403);
  }
  const sourceAccount = process.env.STELLAR_SOURCE_ACCOUNT?.trim();
  if (!sourceAccount) {
    return jsonError("Testnet relayer requires STELLAR_SOURCE_ACCOUNT", 403);
  }
  if (/^S[A-Z2-7]{55}$/.test(sourceAccount)) {
    return jsonError("STELLAR_SOURCE_ACCOUNT must be a local key name, not a secret key", 403);
  }
  if (!checkRateLimit(request)) {
    return jsonError("Rate limit exceeded for local testnet relayer", 429);
  }

  const repoRoot = findRepoRoot();
  let tempDir: string | null = null;
  try {
    const active = await readActive(repoRoot);
    const body = validateBody(await request.json(), active);
    tempDir = await mkdtemp(join(tmpdir(), "lumen-testnet-claim-"));
    const publicInputsPath = join(tempDir, "public-inputs.json");
    await writeFile(
      publicInputsPath,
      `${JSON.stringify(publicInputsArg(body.publicInputs), null, 2)}\n`,
      "utf8"
    );

    const simulation = run(
      "stellar",
      invokeArgs({
        active,
        sourceAccount,
        publicInputsPath,
        proof: body.proofEncodingForSoroban,
        send: "no"
      }),
      repoRoot
    );
    if (simulation.status !== 0) {
      const rejected = contractErrorStatus(simulation);
      return NextResponse.json(
        {
          ok: false,
          status: rejected.status,
          message: rejected.message,
          readableResult: `${simulation.stdout}\n${simulation.stderr}`.trim(),
          stats: readStats(repoRoot, active, sourceAccount)
        },
        { status: 409 }
      );
    }

    const submitted = run(
      "stellar",
      invokeArgs({
        active,
        sourceAccount,
        publicInputsPath,
        proof: body.proofEncodingForSoroban
      }),
      repoRoot
    );
    if (submitted.status !== 0) {
      const rejected = contractErrorStatus(submitted);
      return NextResponse.json(
        {
          ok: false,
          status: rejected.status,
          message: rejected.message,
          readableResult: `${submitted.stdout}\n${submitted.stderr}`.trim(),
          stats: readStats(repoRoot, active, sourceAccount)
        },
        { status: 409 }
      );
    }

    const txHash = parseTxHash(submitted);
    return NextResponse.json({
      ok: true,
      status: "claim_accepted",
      message: "Claim accepted on Stellar testnet",
      txHash,
      readableResult: `${submitted.stdout}\n${submitted.stderr}`.trim(),
      stats: readStats(repoRoot, active, sourceAccount)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 400);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

