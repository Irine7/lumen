export type ActiveTestnetState = {
  ok: boolean;
  mode: "live" | "metadata_only" | "error";
  error?: string;
  deployment: {
    assetMode: string;
    assetCode: string;
    assetContractId: string;
    campaignContractId: string;
    verifierContractId: string;
    campaignId: string;
    eligibilityRoot: string;
    complianceRoot: string;
    policyHash: string;
    verificationKeyHash: string;
    budget: string;
    escrowFunded: string;
    perRecipientCap: string;
  };
  live?: {
    verifierMode?: string;
    claimCount?: number;
    totalClaimed?: number;
    remainingBudget?: number;
    escrowBalance?: number;
    actualTokenBalance?: number;
    duplicateClaimsBlocked?: number;
    invalidClaimsBlocked?: number;
  };
  computed: {
    campaignState: "pristine" | "partially_used" | "consumed" | "unread";
    readyForFullDemo: boolean;
    statusMessage: string;
  };
};

export async function fetchActiveTestnetState(): Promise<ActiveTestnetState> {
  const response = await fetch("/api/testnet/state", { cache: "no-store" });
  return (await response.json()) as ActiveTestnetState;
}
