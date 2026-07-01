import type {
  CampaignConfig,
  CampaignEvent,
  CampaignStats,
  ClaimProofEnvelope,
  ClaimPublicInputs,
  Hex32
} from "@lumen-aid/shared";
import { verifyClaimProofLocally } from "@lumen-aid/prover";

const DEMO_INITIAL_EVENT_AT = "2026-07-01T00:00:00.000Z";

export interface LumenStellarEnv {
  network: "localnet" | "testnet" | "mainnet";
  rpcUrl: string;
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
}

export interface LumenCampaignSnapshot {
  campaign: CampaignConfig;
  stats: CampaignStats;
  usedNullifiers: Hex32[];
  events: CampaignEvent[];
}

export interface SubmitClaimResult {
  ok: boolean;
  status:
    | "claim_accepted"
    | "duplicate_rejected"
    | "invalid_rejected"
    | "campaign_closed";
  message: string;
  stats: CampaignStats;
}

export function readLumenStellarEnv(
  env: Record<string, string | undefined>
): LumenStellarEnv {
  return {
    network:
      env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ||
      env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? env.NEXT_PUBLIC_STELLAR_NETWORK
        : "localnet",
    rpcUrl: env.NEXT_PUBLIC_RPC_URL ?? "",
    campaignContractId: env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID ?? "",
    verifierContractId: env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? "",
    mockTokenContractId: env.NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID ?? ""
  };
}

function now(): string {
  return new Date().toISOString();
}

function initialStats(campaign: CampaignConfig): CampaignStats {
  return {
    totalClaimed: 0,
    claimCount: 0,
    remainingBudget: campaign.budget,
    duplicateClaimsBlocked: 0,
    invalidClaimsBlocked: 0,
    lastEvent: null
  };
}

function event(
  type: CampaignEvent["type"],
  message: string,
  extras = {},
  at = now()
): CampaignEvent {
  return {
    type,
    at,
    message,
    ...extras
  };
}

export class LocalLumenSorobanClient {
  private snapshot: LumenCampaignSnapshot;

  constructor(campaign: CampaignConfig, snapshot?: LumenCampaignSnapshot) {
    this.snapshot =
      snapshot ??
      ({
        campaign,
        stats: initialStats(campaign),
        usedNullifiers: [],
        events: [
          event(
            "campaign_initialized",
            "Campaign initialized on local Soroban simulator",
            {},
            DEMO_INITIAL_EVENT_AT
          )
        ]
      } satisfies LumenCampaignSnapshot);
  }

  createCampaign(config: CampaignConfig): CampaignConfig {
    this.snapshot = {
      campaign: config,
      stats: initialStats(config),
      usedNullifiers: [],
      events: [event("campaign_initialized", "Campaign initialized on local Soroban simulator")]
    };
    return config;
  }

  getCampaign(): CampaignConfig {
    return this.snapshot.campaign;
  }

  getCampaignStats(): CampaignStats {
    return this.snapshot.stats;
  }

  getRecentEvents(): CampaignEvent[] {
    return [...this.snapshot.events].reverse().slice(0, 8);
  }

  isNullifierUsed(nullifierHash: Hex32): boolean {
    return this.snapshot.usedNullifiers.some(
      (stored) => stored.toLowerCase() === nullifierHash.toLowerCase()
    );
  }

  updateRoots(newEligibilityRoot: Hex32, newDenyRoot: Hex32 | null): CampaignConfig {
    this.snapshot.campaign = {
      ...this.snapshot.campaign,
      eligibilityRoot: newEligibilityRoot,
      denyRoot: newDenyRoot
    };
    this.snapshot.events.push(event("roots_updated", "Operator updated campaign roots"));
    return this.snapshot.campaign;
  }

  closeCampaign(): CampaignConfig {
    this.snapshot.campaign = {
      ...this.snapshot.campaign,
      isActive: false
    };
    const closeEvent = event("campaign_closed", "Campaign closed by operator");
    this.snapshot.events.push(closeEvent);
    this.snapshot.stats = {
      ...this.snapshot.stats,
      lastEvent: closeEvent
    };
    return this.snapshot.campaign;
  }

  async submitClaim(
    publicInputs: ClaimPublicInputs,
    proof: ClaimProofEnvelope
  ): Promise<SubmitClaimResult> {
    const campaign = this.snapshot.campaign;

    const reject = (
      status: SubmitClaimResult["status"],
      message: string,
      nullifierHash?: Hex32
    ): SubmitClaimResult => {
      const rejectEvent = event(
        status === "duplicate_rejected" ? "duplicate_rejected" : "invalid_rejected",
        message,
        nullifierHash ? { nullifierHash } : {}
      );

      this.snapshot.events.push(rejectEvent);
      this.snapshot.stats = {
        ...this.snapshot.stats,
        duplicateClaimsBlocked:
          status === "duplicate_rejected"
            ? this.snapshot.stats.duplicateClaimsBlocked + 1
            : this.snapshot.stats.duplicateClaimsBlocked,
        invalidClaimsBlocked:
          status === "invalid_rejected"
            ? this.snapshot.stats.invalidClaimsBlocked + 1
            : this.snapshot.stats.invalidClaimsBlocked,
        lastEvent: rejectEvent
      };

      return {
        ok: false,
        status,
        message,
        stats: this.snapshot.stats
      };
    };

    if (!campaign.isActive) {
      return reject("campaign_closed", "Campaign is closed", publicInputs.nullifierHash);
    }

    if (publicInputs.campaignId.toLowerCase() !== campaign.campaignId.toLowerCase()) {
      return reject("invalid_rejected", "Wrong campaign id", publicInputs.nullifierHash);
    }

    if (publicInputs.eligibilityRoot.toLowerCase() !== campaign.eligibilityRoot.toLowerCase()) {
      return reject("invalid_rejected", "Wrong eligibility root", publicInputs.nullifierHash);
    }

    if (publicInputs.policyHash.toLowerCase() !== campaign.policyHash.toLowerCase()) {
      return reject("invalid_rejected", "Wrong policy hash", publicInputs.nullifierHash);
    }

    if (publicInputs.maxAmount !== campaign.perRecipientCap) {
      return reject("invalid_rejected", "Wrong max amount", publicInputs.nullifierHash);
    }

    if (publicInputs.amount > campaign.perRecipientCap) {
      return reject("invalid_rejected", "Amount exceeds campaign cap", publicInputs.nullifierHash);
    }

    if (this.snapshot.stats.remainingBudget < publicInputs.amount) {
      return reject("invalid_rejected", "Campaign budget exhausted", publicInputs.nullifierHash);
    }

    if (this.isNullifierUsed(publicInputs.nullifierHash)) {
      return reject(
        "duplicate_rejected",
        "Nullifier has already claimed this campaign",
        publicInputs.nullifierHash
      );
    }

    const proofOk = await verifyClaimProofLocally(proof, publicInputs);
    if (!proofOk) {
      return reject("invalid_rejected", "Verifier rejected proof", publicInputs.nullifierHash);
    }

    this.snapshot.usedNullifiers.push(publicInputs.nullifierHash);
    const acceptedEvent = event("claim_accepted", "Claim accepted by campaign contract", {
      nullifierHash: publicInputs.nullifierHash,
      amount: publicInputs.amount
    });

    this.snapshot.events.push(acceptedEvent);
    this.snapshot.stats = {
      totalClaimed: this.snapshot.stats.totalClaimed + publicInputs.amount,
      claimCount: this.snapshot.stats.claimCount + 1,
      remainingBudget: this.snapshot.stats.remainingBudget - publicInputs.amount,
      duplicateClaimsBlocked: this.snapshot.stats.duplicateClaimsBlocked,
      invalidClaimsBlocked: this.snapshot.stats.invalidClaimsBlocked,
      lastEvent: acceptedEvent
    };

    return {
      ok: true,
      status: "claim_accepted",
      message: "Claim accepted",
      stats: this.snapshot.stats
    };
  }

  exportSnapshot(): LumenCampaignSnapshot {
    return {
      ...this.snapshot,
      usedNullifiers: [...this.snapshot.usedNullifiers],
      events: [...this.snapshot.events]
    };
  }
}

export function createLocalLumenClient(
  campaign: CampaignConfig,
  snapshot?: LumenCampaignSnapshot
): LocalLumenSorobanClient {
  return new LocalLumenSorobanClient(campaign, snapshot);
}

export async function createCampaign(
  client: LocalLumenSorobanClient,
  config: CampaignConfig
): Promise<CampaignConfig> {
  return client.createCampaign(config);
}

export async function submitClaim(
  client: LocalLumenSorobanClient,
  publicInputs: ClaimPublicInputs,
  proof: ClaimProofEnvelope
): Promise<SubmitClaimResult> {
  return client.submitClaim(publicInputs, proof);
}

export async function getCampaignStats(
  client: LocalLumenSorobanClient
): Promise<CampaignStats> {
  return client.getCampaignStats();
}

export async function isNullifierUsed(
  client: LocalLumenSorobanClient,
  nullifierHash: Hex32
): Promise<boolean> {
  return client.isNullifierUsed(nullifierHash);
}
