import { describe, expect, it } from "vitest";
import { demoRecipients } from "@lumen-aid/shared";
import { buildDemoEligibilityTree, createDemoCampaignConfig } from "@lumen-aid/merkle";
import { generateClaimProof } from "@lumen-aid/prover";
import { createLocalLumenClient } from "./index";

describe("local Soroban-shaped campaign client", () => {
  it("accepts a valid claim and rejects a duplicate nullifier", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const client = createLocalLumenClient(campaign);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    await expect(client.submitClaim(proof.publicInputs, proof.proof)).resolves.toMatchObject({
      ok: true,
      status: "claim_accepted"
    });

    await expect(client.submitClaim(proof.publicInputs, proof.proof)).resolves.toMatchObject({
      ok: false,
      status: "duplicate_rejected"
    });
  });

  it("rejects wrong root, wrong policy, and amount over cap", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const client = createLocalLumenClient(campaign);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          campaignId:
            "0x0000000000000000000000000000000000000000000000000000000000000003"
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          eligibilityRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000001"
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          complianceRoot:
            "0x0000000000000000000000000000000000000000000000000000000000000004"
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          policyHash:
            "0x0000000000000000000000000000000000000000000000000000000000000002"
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          maxAmount: campaign.perRecipientCap + 1
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });

    await expect(
      client.submitClaim(
        {
          ...proof.publicInputs,
          amount: campaign.perRecipientCap + 1
        },
        proof.proof
      )
    ).resolves.toMatchObject({ ok: false, status: "invalid_rejected" });
  });

  it("rejects claim after close", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const client = createLocalLumenClient(campaign);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    client.closeCampaign();

    await expect(client.submitClaim(proof.publicInputs, proof.proof)).resolves.toMatchObject({
      ok: false,
      status: "campaign_closed"
    });
  });
});
