import {
  campaignConfigArgPath,
  campaignStatePath,
  demoCampaignValues,
  invokeContract,
  readDeployment,
  requireCleanSourceAccount,
  run,
  writeJson,
  type TestnetCampaignState
} from "./stellar-testnet-common";

async function main(): Promise<void> {
  const sourceAccount = requireCleanSourceAccount();
  const deployment = await readDeployment();

  const doctor = run("pnpm", ["stellar:doctor"]);
  if (doctor.status !== 0) {
    throw new Error("Stellar preflight failed");
  }

  const publicKey = deployment.deployerPublicKey;
  const { campaign, config, startLedger, endLedger } = demoCampaignValues(
    deployment,
    publicKey
  );
  await writeJson(campaignConfigArgPath, config);

  const existing = invokeContract({
    contractId: deployment.campaignContractId,
    sourceAccount,
    fn: "get_campaign",
    allowFailure: true,
    send: "no",
    suppressOutput: true
  });

  if (existing.status === 0) {
    console.log("[ok] Campaign already initialized on testnet");
  } else {
    const result = invokeContract({
      contractId: deployment.campaignContractId,
      sourceAccount,
      fn: "initialize",
      fnArgs: ["--config-file-path", campaignConfigArgPath]
    });

    if (result.status !== 0) {
      throw new Error("Campaign initialization failed");
    }
    console.log("[ok] Campaign initialized on testnet");
  }

  const state: TestnetCampaignState = {
    network: "testnet",
    campaignContractId: deployment.campaignContractId,
    verifierContractId: deployment.verifierContractId,
    mockTokenContractId: deployment.mockTokenContractId,
    campaignId: campaign.campaignId,
    eligibilityRoot: campaign.eligibilityRoot,
    policyHash: campaign.policyHash,
    operator: publicKey,
    asset: deployment.mockTokenContractId,
    budget: String(campaign.budget),
    perRecipientCap: String(campaign.perRecipientCap),
    startLedger,
    endLedger,
    initializedAt: new Date().toISOString(),
    mode: "real_groth16_verifier",
    notes:
      "Deterministic demo campaign initialized on Stellar testnet with the same eligibility root and policy hash used by the local demo."
  };

  await writeJson(campaignStatePath, state);
  console.log(`[ok] wrote ${campaignStatePath}`);
  console.log(`Campaign ID: ${campaign.campaignId}`);
  console.log(`Eligibility root: ${campaign.eligibilityRoot}`);
  console.log(`Policy hash: ${campaign.policyHash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
