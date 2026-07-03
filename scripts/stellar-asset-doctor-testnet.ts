import {
  AIDUSD_CODE,
  aidusdContractId,
  aidusdKeyNames,
  assetString,
  ensureFundedKey,
  getLocalKeyPublicKey,
  writeAidusdBlocker
} from "./stellar-aidusd-common";
import { run } from "./stellar-testnet-common";

async function main(): Promise<void> {
  try {
    const version = run("stellar", ["--version"], { suppressCommand: true });
    if (version.status !== 0) {
      throw new Error("stellar CLI is not available");
    }

    const { issuer, distributor } = aidusdKeyNames();
    if (/^S[A-Z2-7]{55}$/.test(issuer) || /^S[A-Z2-7]{55}$/.test(distributor)) {
      throw new Error("AIDUSD key configuration must use local Stellar CLI key names, not secret keys.");
    }

    const issuerPublicKey = getLocalKeyPublicKey(issuer) ?? ensureFundedKey(issuer);
    const distributorPublicKey = getLocalKeyPublicKey(distributor);
    if (!distributorPublicKey) {
      throw new Error(`Could not resolve distributor/source account key ${distributor}`);
    }

    console.log(`[ok] asset code: ${AIDUSD_CODE}`);
    console.log(`[ok] issuer key name: ${issuer}`);
    console.log(`[ok] issuer public key: ${issuerPublicKey}`);
    console.log(`[ok] distributor key name: ${distributor}`);
    console.log(`[ok] distributor public key: ${distributorPublicKey}`);
    console.log(`[ok] asset string: ${assetString(issuerPublicKey)}`);
    console.log(`[ok] deterministic AIDUSD SAC contract ID: ${aidusdContractId(issuerPublicKey)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeAidusdBlocker(message);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
