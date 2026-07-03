import {
  AIDUSD_CODE,
  aidusdKeyNames,
  changeTrust,
  deployAidusdSac,
  ensureFundedKey,
  getLocalKeyPublicKey,
  issueAsset,
  readTokenBalance,
  writeAidusdBlocker,
  writeAidusdDeployment
} from "./stellar-aidusd-common";

const distributorIssueAmount = "1000000000";

async function main(): Promise<void> {
  try {
    const { issuer, distributor } = aidusdKeyNames();
    const issuerPublicKey = ensureFundedKey(issuer);
    const distributorPublicKey = getLocalKeyPublicKey(distributor);
    if (!distributorPublicKey) {
      throw new Error(`Could not resolve distributor/source account key ${distributor}`);
    }

    changeTrust(distributor, issuerPublicKey);
    issueAsset({
      issuerKeyName: issuer,
      issuerPublicKey,
      destinationPublicKey: distributorPublicKey,
      amount: distributorIssueAmount
    });

    const assetContractId = deployAidusdSac(distributor, issuerPublicKey);
    const distributorSacBalance = readTokenBalance({
      assetContractId,
      sourceAccount: distributor,
      id: distributorPublicKey
    });

    await writeAidusdDeployment({
      network: "testnet",
      assetCode: AIDUSD_CODE,
      issuerKeyName: issuer,
      issuerPublicKey,
      distributorKeyName: distributor,
      distributorPublicKey,
      assetContractId,
      setupAt: new Date().toISOString(),
      notes:
        "AIDUSD testnet issued asset setup. Only public addresses and the SAC contract ID are recorded."
    });

    console.log(`[ok] AIDUSD issuer: ${issuerPublicKey}`);
    console.log(`[ok] AIDUSD distributor/operator: ${distributorPublicKey}`);
    console.log(`[ok] AIDUSD SAC contract ID: ${assetContractId}`);
    console.log(`[ok] distributor AIDUSD SAC balance: ${distributorSacBalance}`);
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
