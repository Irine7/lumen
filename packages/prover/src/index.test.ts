import { describe, expect, it } from "vitest";
import { demoRecipients } from "@lumen-aid/shared";
import {
  buildDemoEligibilityTree,
  createDemoCampaignConfig,
  deriveNullifier
} from "@lumen-aid/merkle";
import { generateClaimProof, verifyClaimProofLocally } from "./index";

describe("lumen-aid dev prover", () => {
  it("generates and verifies a proof for an eligible recipient", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;

    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    expect(result.ok).toBe(true);
    await expect(verifyClaimProofLocally(result.proof, result.publicInputs)).resolves.toBe(
      true
    );
  });

  it("fails if the Merkle path is wrong", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const bob = demoRecipients.find((recipient) => recipient.id === "bob")!;
    const bobResult = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: bob,
      amount: bob.defaultClaimAmount
    });

    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount,
      proofOverride: {
        merkleProof: {
          leaf: bobResult.privateInputs ? tree.recipientLeafById.bob! : tree.leaves[1]!,
          path: bobResult.privateInputs!.eligibilityMerklePath,
          indices: bobResult.privateInputs!.eligibilityMerkleIndices
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("leaf");
  });

  it("changes nullifier when campaign ID changes", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const first = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });
    const second = await generateClaimProof({
      mode: "dev_verifier",
      campaign: { ...campaign, campaignId: "0x0000000000000000000000000000000000000000000000000000000000000002" },
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    expect(first.publicInputs.nullifierHash).not.toEqual(second.publicInputs.nullifierHash);
  });

  it("keeps the same recipient nullifier stable for the same campaign", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const first = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });
    const second = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    expect(first.publicInputs.nullifierHash).toEqual(second.publicInputs.nullifierHash);
  });

  it("generates a different campaign nullifier for the same recipient", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const first = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });
    const second = await generateClaimProof({
      mode: "dev_verifier",
      campaign: { ...campaign, campaignId: "0x0000000000000000000000000000000000000000000000000000000000000003" },
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    expect(first.publicInputs.nullifierHash).not.toEqual(second.publicInputs.nullifierHash);
  });

  it("fails when amount exceeds campaign cap", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: campaign.perRecipientCap + 1
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Claim amount exceeds per-recipient cap");
  });

  it("generates an invalid Mallory attempt that local verification rejects", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const mallory = demoRecipients.find((recipient) => recipient.id === "mallory")!;
    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: mallory,
      amount: mallory.defaultClaimAmount
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Recipient is not included in the eligibility Merkle tree");
    await expect(verifyClaimProofLocally(result.proof, result.publicInputs)).resolves.toBe(
      false
    );
  });

  it("rejects an eligible recipient without compliance clearance", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const eve = demoRecipients.find((recipient) => recipient.id === "eve")!;
    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: eve,
      amount: eve.defaultClaimAmount
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Recipient is not included in the compliance clearance Merkle tree"
    );
    await expect(verifyClaimProofLocally(result.proof, result.publicInputs)).resolves.toBe(
      false
    );
  });

  it("derives Alice nullifier from recipient secret and campaign ID", async () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const result = await generateClaimProof({
      mode: "dev_verifier",
      campaign,
      tree,
      recipient: alice,
      amount: alice.defaultClaimAmount
    });

    expect(result.publicInputs.nullifierHash).toEqual(
      deriveNullifier(alice.recipientSecret, campaign.campaignId)
    );
  });
});
