import { describe, expect, it } from "vitest";
import { demoRecipients } from "@lumen-aid/shared";
import {
  buildDemoComplianceTree,
  buildDemoEligibilityTree,
  createComplianceLeaf,
  createDemoCampaignConfig,
  createEligibilityLeaf,
  deriveNullifier,
  getMerkleProofForRecipient,
  verifyMerkleProofLocally
} from "./index";

describe("lumen-aid Merkle utilities", () => {
  it("verifies eligible recipient membership", () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = getMerkleProofForRecipient(tree, alice)!;

    expect(
      verifyMerkleProofLocally(proof.leaf, proof, campaign.eligibilityRoot)
    ).toBe(true);
  });

  it("verifies compliant recipient membership", () => {
    const complianceTree = buildDemoComplianceTree();
    const campaign = createDemoCampaignConfig(undefined, complianceTree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = getMerkleProofForRecipient(complianceTree, alice)!;

    expect(
      verifyMerkleProofLocally(proof.leaf, proof, campaign.complianceRoot)
    ).toBe(true);
  });

  it("keeps Eve outside the compliance tree", () => {
    const complianceTree = buildDemoComplianceTree();
    const campaign = createDemoCampaignConfig(undefined, complianceTree);
    const eve = demoRecipients.find((recipient) => recipient.id === "eve")!;
    const eveLeaf = createComplianceLeaf({
      recipientSecret: eve.recipientSecret,
      identityHash: eve.identityHash,
      complianceLeafSalt: eve.complianceLeafSalt,
      policyHash: campaign.policyHash
    });

    expect(complianceTree.leaves.includes(eveLeaf)).toBe(false);
    expect(getMerkleProofForRecipient(complianceTree, eve)).toBeNull();
  });

  it("rejects a wrong Merkle path", () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const proof = getMerkleProofForRecipient(tree, alice)!;
    const wrongPath = [...proof.path].reverse();

    expect(
      verifyMerkleProofLocally(
        proof.leaf,
        { path: wrongPath, indices: proof.indices },
        campaign.eligibilityRoot
      )
    ).toBe(false);
  });

  it("changes nullifier when campaign ID changes", () => {
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;

    expect(deriveNullifier(alice.recipientSecret, "0x01")).not.toEqual(
      deriveNullifier(alice.recipientSecret, "0x02")
    );
  });

  it("keeps same campaign nullifier stable for same recipient", () => {
    const alice = demoRecipients.find((recipient) => recipient.id === "alice")!;
    const first = deriveNullifier(alice.recipientSecret, "0x01");
    const second = deriveNullifier(alice.recipientSecret, "0x01");

    expect(first).toEqual(second);
  });

  it("keeps Mallory outside the demo tree", () => {
    const tree = buildDemoEligibilityTree();
    const campaign = createDemoCampaignConfig(tree);
    const mallory = demoRecipients.find((recipient) => recipient.id === "mallory")!;
    const malloryLeaf = createEligibilityLeaf({
      recipientSecret: mallory.recipientSecret,
      identityHash: mallory.identityHash,
      leafSalt: mallory.leafSalt,
      policyHash: campaign.policyHash
    });

    expect(tree.leaves.includes(malloryLeaf)).toBe(false);
    expect(getMerkleProofForRecipient(tree, mallory)).toBeNull();
  });
});
