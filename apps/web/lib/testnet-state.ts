import { readLumenStellarEnv, type LumenStellarEnv } from "@lumen-aid/stellar";

export type PublicTestnetStatus =
  | { kind: "connected"; label: "Testnet connected"; tone: "green" }
  | { kind: "not_configured"; label: "Testnet not configured"; tone: "amber" }
  | { kind: "local_demo"; label: "Local demo only"; tone: "amber" };

export function readPublicStellarEnv(): LumenStellarEnv {
  return readLumenStellarEnv({
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID: process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID,
    NEXT_PUBLIC_VERIFIER_CONTRACT_ID: process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID,
    NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID
  });
}

export function getPublicTestnetStatus(env: LumenStellarEnv): PublicTestnetStatus {
  if (env.network !== "testnet") {
    return { kind: "local_demo", label: "Local demo only", tone: "amber" };
  }

  if (!env.rpcUrl || !env.campaignContractId || !env.verifierContractId) {
    return { kind: "not_configured", label: "Testnet not configured", tone: "amber" };
  }

  return { kind: "connected", label: "Testnet connected", tone: "green" };
}
