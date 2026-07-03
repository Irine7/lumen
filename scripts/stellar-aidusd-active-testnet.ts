import {
  AIDUSD_CODE,
  readTokenBalance,
  writeAidusdBlocker
} from "./stellar-aidusd-common";
import {
  activeTestnetPath,
  invokeContract,
  readJson,
  requireCleanSourceAccount,
  type ActiveTestnetDeployment
} from "./stellar-testnet-common";

function parseInteger(stdout: string, label: string): string {
  const match = stdout.match(/-?\d+/);
  if (!match) {
    throw new Error(`Could not parse integer from ${label}`);
  }
  return match[0];
}

async function main(): Promise<void> {
  try {
    const sourceAccount = requireCleanSourceAccount();
    const active = await readJson<ActiveTestnetDeployment>(activeTestnetPath);
    if (active.network !== "testnet") {
      throw new Error("Active deployment is not testnet");
    }
    if (active.assetMode !== "aidusd_sac" || active.assetCode !== AIDUSD_CODE) {
      throw new Error(`Active deployment is not AIDUSD SAC mode; found ${active.assetMode ?? active.assetCode ?? "unknown"}`);
    }
    if (!active.assetContractId || !active.assetIssuer) {
      throw new Error("Active AIDUSD deployment is missing assetContractId or assetIssuer");
    }

    const escrowResult = invokeContract({
      contractId: active.campaignContractId,
      sourceAccount,
      fn: "get_escrow_balance",
      send: "no",
      suppressOutput: true
    });
    const escrowBalance = parseInteger(escrowResult.stdout, "get_escrow_balance");

    console.log(`[ok] asset mode: ${active.assetMode}`);
    console.log(`[ok] asset code: ${active.assetCode}`);
    console.log(`[ok] asset issuer: ${active.assetIssuer}`);
    console.log(`[ok] asset contract ID: ${active.assetContractId}`);
    console.log(`[ok] campaign contract ID: ${active.campaignContractId}`);
    console.log(`[ok] verifier contract ID: ${active.verifierContractId}`);
    console.log(`[ok] campaign ID: ${active.campaignId}`);
    console.log(`[ok] eligibility root: ${active.eligibilityRoot}`);
    console.log(`[ok] compliance root: ${active.complianceRoot}`);
    console.log(`[ok] policy hash: ${active.policyHash}`);
    console.log(`[ok] escrow funded: ${active.escrowFunded ?? escrowBalance}`);
    console.log(`[ok] escrow balance: ${escrowBalance}`);

    for (const recipient of active.recipients) {
      if (!recipient.payoutAddress) {
        continue;
      }
      console.log(
        `[ok] recipient ${recipient.displayName}: eligible=${recipient.eligible} compliant=${recipient.compliant ?? false} balance=${readTokenBalance({
          assetContractId: active.assetContractId,
          sourceAccount,
          id: recipient.payoutAddress
        })}`
      );
    }
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
