import active from "../../../deployments/active-testnet.json";

type ActiveDeploymentJson = typeof active;

function verifierMode(input: ActiveDeploymentJson): string {
  const mode = input.verifierInfo?.mode;
  return typeof mode === "string" ? mode : "unknown";
}

function verificationKeyHash(input: ActiveDeploymentJson): string {
  const hash =
    "verificationKeyHash" in input.verifierInfo
      ? input.verifierInfo.verificationKeyHash
      : undefined;
  return typeof hash === "string" ? hash : "";
}

export const activeDeployment = {
  assetCode: active.assetCode,
  assetMode: active.assetMode,
  sacLabel: `${active.assetCode}/SAC`,
  tokenContractId: active.assetContractId,
  campaignContractId: active.campaignContractId,
  verifierContractId: active.verifierContractId,
  verifierMode: verifierMode(active),
  campaignId: active.campaignId,
  eligibilityRoot: active.eligibilityRoot,
  complianceRoot: active.complianceRoot,
  policyHash: active.policyHash,
  verificationKeyHash: verificationKeyHash(active),
  budget: active.budget,
  escrowFunded: active.escrowFunded,
  perRecipientCap: active.perRecipientCap,
  readReason: "Loaded from deployments/active-testnet.json"
} as const;
