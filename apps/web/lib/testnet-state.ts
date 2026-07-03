export type PublicTestnetStatus =
  | { kind: "connected"; label: "Testnet connected"; tone: "green" }
  | { kind: "server_read"; label: "Testnet state via server"; tone: "cyan" }
  | { kind: "local_demo"; label: "Local demo only"; tone: "amber" };

type PublicStellarEnv = {
  network: "localnet" | "testnet" | "mainnet";
  campaignContractId: string;
  verifierContractId: string;
};

export function readPublicStellarEnv(): PublicStellarEnv {
  return {
    network:
      process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ||
      process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? process.env.NEXT_PUBLIC_STELLAR_NETWORK
        : "localnet",
    campaignContractId: process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID ?? "",
    verifierContractId: process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? ""
  };
}

export function getPublicTestnetStatus(env: PublicStellarEnv): PublicTestnetStatus {
  if (env.network !== "testnet") {
    return { kind: "local_demo", label: "Local demo only", tone: "amber" };
  }

  if (!env.campaignContractId || !env.verifierContractId) {
    return { kind: "server_read", label: "Testnet state via server", tone: "cyan" };
  }

  return { kind: "connected", label: "Testnet connected", tone: "green" };
}
