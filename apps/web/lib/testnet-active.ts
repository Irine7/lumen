import type { CampaignConfig, DemoRecipient, Hex32 } from "@lumen-aid/shared";
import { testnetDemoRecipients } from "@lumen-aid/shared";
import type { LumenStellarEnv } from "@lumen-aid/stellar";

export type ActiveTestnetDeployment = {
  network: "testnet";
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId?: string;
  assetContractId?: string;
  assetMode?: "native_xlm_sac" | "aidusd_sac" | "mock_token";
  assetCode?: string;
  assetIssuer?: string;
  escrowFunded?: string;
  campaignId: Hex32;
  eligibilityRoot: Hex32;
  complianceRoot: Hex32;
  policyHash: Hex32;
  operator: string;
  asset: string;
  budget: string;
  perRecipientCap: string;
  startLedger: number;
  endLedger: number;
  createdAt: string;
  verifierInfo:
    | {
        mode: "real_groth16" | "dev_verifier";
        version: string;
        verifierId: Hex32;
        circuitId: Hex32;
        verificationKeyHash: Hex32;
      }
    | {
        mode: "legacy_not_introspectable";
        notes: string;
      };
  recipients: {
    id: DemoRecipient["id"];
    displayName: string;
    eligible: boolean;
    compliant?: boolean;
    defaultClaimAmount: number;
    payoutAddress?: string;
  }[];
  notes: string;
};

export type ActiveTestnetConfigResult =
  | { status: "ready"; active: ActiveTestnetDeployment }
  | { status: "not_configured" | "error"; message: string };

export const activeTestnetRecipients = testnetDemoRecipients;

export async function fetchActiveTestnetConfig(): Promise<ActiveTestnetConfigResult> {
  const response = await fetch("/api/testnet/config", { cache: "no-store" });
  const body = (await response.json()) as ActiveTestnetConfigResult;
  return body;
}

export function activeToCampaign(active: ActiveTestnetDeployment): CampaignConfig {
  return {
    campaignId: active.campaignId,
    name: "Active Stellar Testnet Campaign",
    operator: active.operator,
    asset: active.assetContractId ?? active.mockTokenContractId ?? active.asset,
    budget: Number(active.budget),
    perRecipientCap: Number(active.perRecipientCap),
    eligibilityRoot: active.eligibilityRoot,
    complianceRoot: active.complianceRoot,
    denyRoot: null,
    policyHash: active.policyHash,
    verifier: active.verifierContractId,
    startLedger: active.startLedger,
    endLedger: active.endLedger,
    isActive: true
  };
}

export function activeToStellarEnv(active: ActiveTestnetDeployment): LumenStellarEnv {
  return {
    network: "testnet",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "",
    campaignContractId: active.campaignContractId,
    verifierContractId: active.verifierContractId,
    mockTokenContractId: active.mockTokenContractId ?? active.assetContractId ?? ""
  };
}

export function verifierModeLabel(active: ActiveTestnetDeployment): string {
  if (active.verifierInfo.mode === "legacy_not_introspectable") {
    return "Verifier mode: legacy verifier, mode not introspectable";
  }

  return `Verifier mode: ${active.verifierInfo.mode}`;
}
