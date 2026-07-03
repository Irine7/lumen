import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { NextResponse } from "next/server";
import {
  getCampaignConfig,
  getCampaignEscrowBalance,
  getCampaignStats,
  getVerifierStatus,
  type LumenStellarEnv,
  type StellarReadResult,
  type TestnetCampaignConfig
} from "@lumen-aid/stellar";
import type { ActiveTestnetState } from "@/lib/active-testnet-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";

type ActiveDeploymentFile = {
  network?: string;
  assetMode?: unknown;
  assetCode?: unknown;
  assetContractId?: unknown;
  campaignContractId?: unknown;
  verifierContractId?: unknown;
  campaignId?: unknown;
  eligibilityRoot?: unknown;
  complianceRoot?: unknown;
  policyHash?: unknown;
  budget?: unknown;
  escrowFunded?: unknown;
  perRecipientCap?: unknown;
  mockTokenContractId?: unknown;
  verifierInfo?: {
    mode?: unknown;
    verificationKeyHash?: unknown;
  };
};

type NormalizedDeployment = ActiveTestnetState["deployment"];

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

function stringField(
  value: unknown,
  label: keyof NormalizedDeployment,
  missing: string[]
): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  missing.push(label);
  return "";
}

function normalizeDeployment(active: ActiveDeploymentFile): {
  deployment: NormalizedDeployment;
  missing: string[];
} {
  const missing: string[] = [];
  const assetContractId = active.assetContractId ?? active.mockTokenContractId;
  const deployment = {
    assetMode: stringField(active.assetMode, "assetMode", missing),
    assetCode: stringField(active.assetCode, "assetCode", missing),
    assetContractId: stringField(assetContractId, "assetContractId", missing),
    campaignContractId: stringField(
      active.campaignContractId,
      "campaignContractId",
      missing
    ),
    verifierContractId: stringField(active.verifierContractId, "verifierContractId", missing),
    ...(typeof active.verifierInfo?.mode === "string"
      ? { verifierMode: active.verifierInfo.mode }
      : {}),
    campaignId: stringField(active.campaignId, "campaignId", missing),
    eligibilityRoot: stringField(active.eligibilityRoot, "eligibilityRoot", missing),
    complianceRoot: stringField(active.complianceRoot, "complianceRoot", missing),
    policyHash: stringField(active.policyHash, "policyHash", missing),
    verificationKeyHash: stringField(
      active.verifierInfo?.verificationKeyHash,
      "verificationKeyHash",
      missing
    ),
    budget: stringField(active.budget, "budget", missing),
    escrowFunded: stringField(active.escrowFunded, "escrowFunded", missing),
    perRecipientCap: stringField(active.perRecipientCap, "perRecipientCap", missing)
  } satisfies NormalizedDeployment;

  return { deployment, missing };
}

function serverReadEnv(deployment: NormalizedDeployment): LumenStellarEnv {
  return {
    network: "testnet",
    rpcUrl:
      process.env.STELLAR_RPC_URL?.trim() ||
      process.env.SOROBAN_RPC_URL?.trim() ||
      process.env.RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
      DEFAULT_TESTNET_RPC_URL,
    campaignContractId: deployment.campaignContractId,
    verifierContractId: deployment.verifierContractId,
    mockTokenContractId: deployment.assetContractId
  };
}

function metadataOnly(
  deployment: NormalizedDeployment,
  reason: string
): ActiveTestnetState {
  return {
    ok: true,
    mode: "metadata_only",
    error: reason,
    deployment,
    ...(deployment.verifierMode ? { live: { verifierMode: deployment.verifierMode } } : {}),
    computed: {
      campaignState: "unavailable",
      readyForFullDemo: false,
      statusMessage: `Campaign metadata loaded. Live stats unavailable: ${reason}`
    }
  };
}

function errorState(
  deployment: NormalizedDeployment,
  message: string,
  status = 500
): NextResponse<ActiveTestnetState> {
  return NextResponse.json(
    {
      ok: false,
      mode: "error",
      error: message,
      deployment,
      ...(deployment.verifierMode ? { live: { verifierMode: deployment.verifierMode } } : {}),
      computed: {
        campaignState: "unavailable",
        readyForFullDemo: false,
        statusMessage: message
      }
    },
    { status }
  );
}

function readProblem(label: string, result: StellarReadResult<unknown>): string | null {
  if (result.status === "ready") {
    return null;
  }
  if (result.status === "not_configured") {
    return `${label} missing env: ${result.missing.join(", ")}`;
  }
  return `${label} contract read failure: ${result.error}`;
}

function asBigInt(value: string, label: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${label} is not an integer: ${value}`);
  }
}

function asNumber(value: string | number, label: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} is not numeric: ${value}`);
  }
  return numeric;
}

function normalizeHex(value: string): string {
  return value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
}

function deploymentMismatches(
  deployment: NormalizedDeployment,
  config: TestnetCampaignConfig
): string[] {
  const mismatches: string[] = [];
  const compare = (label: string, left: string, right: string) => {
    if (left !== right) {
      mismatches.push(label);
    }
  };

  compare("campaignId", normalizeHex(config.campaignId), normalizeHex(deployment.campaignId));
  compare(
    "eligibilityRoot",
    normalizeHex(config.eligibilityRoot),
    normalizeHex(deployment.eligibilityRoot)
  );
  compare(
    "complianceRoot",
    normalizeHex(config.complianceRoot),
    normalizeHex(deployment.complianceRoot)
  );
  compare("policyHash", normalizeHex(config.policyHash), normalizeHex(deployment.policyHash));
  compare("budget", config.budget, deployment.budget);
  compare("perRecipientCap", config.perRecipientCap, deployment.perRecipientCap);
  compare("verifierContractId", config.verifierContractId, deployment.verifierContractId);
  compare("assetContractId", config.asset, deployment.assetContractId);
  return mismatches;
}

function classifyCampaign(args: {
  claimCount: number;
  remainingBudget: string;
  escrowBalance: string;
  escrowFunded: string;
}): ActiveTestnetState["computed"]["campaignState"] {
  const remainingBudget = asBigInt(args.remainingBudget, "remaining budget");
  const escrowBalance = asBigInt(args.escrowBalance, "escrow balance");
  const escrowFunded = asBigInt(args.escrowFunded, "escrow funded");

  if (args.claimCount === 0 && escrowBalance >= escrowFunded) {
    return "pristine";
  }
  if (args.claimCount > 0 && remainingBudget > 0n) {
    return "partially_used";
  }
  if (remainingBudget <= 0n || escrowBalance <= 0n) {
    return "consumed";
  }
  return "partially_used";
}

function statusMessage(campaignState: ActiveTestnetState["computed"]["campaignState"]): string {
  if (campaignState === "pristine") {
    return "Ready for full sequence";
  }
  if (campaignState === "partially_used" || campaignState === "consumed") {
    return "This campaign has already processed claims. Prepare a fresh campaign before a new full run.";
  }
  return "Live stats unavailable.";
}

export async function GET() {
  const emptyDeployment = {
    assetMode: "",
    assetCode: "",
    assetContractId: "",
    campaignContractId: "",
    verifierContractId: "",
    campaignId: "",
    eligibilityRoot: "",
    complianceRoot: "",
    policyHash: "",
    verificationKeyHash: "",
    budget: "",
    escrowFunded: "",
    perRecipientCap: ""
  } satisfies NormalizedDeployment;

  try {
    const activePath = join(findRepoRoot(), "deployments", "active-testnet.json");
    if (!existsSync(activePath)) {
      return errorState(
        emptyDeployment,
        "no active deployment: missing deployments/active-testnet.json",
        404
      );
    }

    const active = JSON.parse(await readFile(activePath, "utf8")) as ActiveDeploymentFile;
    if (active.network !== "testnet") {
      return errorState(emptyDeployment, "stale deployment: active deployment is not testnet", 409);
    }

    const { deployment, missing } = normalizeDeployment(active);
    if (missing.length > 0) {
      return errorState(
        deployment,
        `stale deployment: active-testnet.json is missing ${missing.join(", ")}`,
        409
      );
    }

    const env = serverReadEnv(deployment);
    const [config, stats, escrow, verifier] = await Promise.all([
      getCampaignConfig(env),
      getCampaignStats(env),
      getCampaignEscrowBalance(env),
      getVerifierStatus(env)
    ]);

    const configProblem = readProblem("campaign config", config);
    const statsProblem = readProblem("campaign stats", stats);
    const escrowProblem = readProblem("escrow balance", escrow);
    if (configProblem || statsProblem || escrowProblem) {
      return NextResponse.json(
        metadataOnly(
          deployment,
          configProblem ?? statsProblem ?? escrowProblem ?? "unknown read failure"
        )
      );
    }

    if (config.status !== "ready" || stats.status !== "ready" || escrow.status !== "ready") {
      return NextResponse.json(metadataOnly(deployment, "unknown live read failure"));
    }

    const mismatches = deploymentMismatches(deployment, config.data);
    if (mismatches.length > 0) {
      return NextResponse.json(
        metadataOnly(
          deployment,
          `stale deployment: active metadata differs from on-chain ${mismatches.join(", ")}`
        )
      );
    }

    const campaignState = classifyCampaign({
      claimCount: stats.data.claimCount,
      remainingBudget: stats.data.remainingBudget,
      escrowBalance: escrow.data.balance,
      escrowFunded: deployment.escrowFunded
    });
    const verifierMode =
      verifier.status === "ready"
        ? verifier.data.mode
        : typeof active.verifierInfo?.mode === "string"
          ? active.verifierInfo.mode
          : undefined;
    const verifierProblem = verifier.status === "ready" ? null : readProblem("verifier", verifier);

    const state = {
      ok: true,
      mode: "live",
      ...(verifierProblem ? { error: verifierProblem } : {}),
      deployment,
      live: {
        ...(verifierMode ? { verifierMode } : {}),
        claimCount: stats.data.claimCount,
        totalClaimed: asNumber(stats.data.totalClaimed, "total claimed"),
        remainingBudget: asNumber(stats.data.remainingBudget, "remaining budget"),
        escrowBalance: asNumber(escrow.data.balance, "escrow balance"),
        actualTokenBalance: asNumber(escrow.data.balance, "actual token balance"),
        duplicateClaimsBlocked: stats.data.duplicateClaimsBlocked,
        invalidClaimsBlocked: stats.data.invalidClaimsBlocked
      },
      computed: {
        campaignState,
        readyForFullDemo: campaignState === "pristine",
        statusMessage: statusMessage(campaignState)
      }
    } satisfies ActiveTestnetState;

    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorState(emptyDeployment, `testnet state error: ${message}`, 500);
  }
}
