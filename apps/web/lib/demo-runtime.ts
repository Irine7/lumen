"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CampaignConfig,
  ClaimProofResult,
  DemoRecipient
} from "@lumen-aid/shared";
import { demoRecipients } from "@lumen-aid/shared";
import {
  buildDemoComplianceTree,
  buildDemoEligibilityTree,
  createDemoCampaignConfig
} from "@lumen-aid/merkle";
import { generateClaimProof } from "@lumen-aid/prover";
import { createLocalLumenClient } from "@lumen-aid/stellar";
import type { LumenCampaignSnapshot, SubmitClaimResult } from "@lumen-aid/stellar";

const STORAGE_KEY = "lumen-aid-demo-state-v0";

export function createInitialSnapshot(): LumenCampaignSnapshot {
  const tree = buildDemoEligibilityTree();
  const complianceTree = buildDemoComplianceTree();
  const campaign = createDemoCampaignConfig(tree, complianceTree);
  return createLocalLumenClient(campaign).exportSnapshot();
}

function readSnapshot(): LumenCampaignSnapshot {
  if (typeof window === "undefined") {
    return createInitialSnapshot();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialSnapshot();
  }

  try {
    return JSON.parse(raw) as LumenCampaignSnapshot;
  } catch {
    return createInitialSnapshot();
  }
}

function writeSnapshot(snapshot: LumenCampaignSnapshot): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}

export function useLumenDemo() {
  const [snapshot, setSnapshot] = useState<LumenCampaignSnapshot>(() => createInitialSnapshot());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = readSnapshot();
    setSnapshot(loaded);
    setReady(true);
  }, []);

  const tree = useMemo(() => buildDemoEligibilityTree(), []);
  const complianceTree = useMemo(() => buildDemoComplianceTree(), []);

  const persist = useCallback((next: LumenCampaignSnapshot) => {
    writeSnapshot(next);
    setSnapshot(next);
  }, []);

  const resetDemo = useCallback(() => {
    const next = createInitialSnapshot();
    persist(next);
  }, [persist]);

  const createCampaign = useCallback(
    (config: CampaignConfig) => {
      const client = createLocalLumenClient(config);
      const next = client.exportSnapshot();
      persist(next);
      return next.campaign;
    },
    [persist]
  );

  const updateCampaign = useCallback(
    (config: CampaignConfig) => {
      const next = createLocalLumenClient(config).exportSnapshot();
      persist(next);
      return next.campaign;
    },
    [persist]
  );

  const generateProof = useCallback(
    async (recipient: DemoRecipient, amount: number): Promise<ClaimProofResult> =>
      generateClaimProof({
        mode: "dev_verifier",
        campaign: snapshot.campaign,
        tree,
        complianceTree,
        recipient,
        amount
      }),
    [complianceTree, snapshot.campaign, tree]
  );

  const submitProof = useCallback(
    async (proofResult: ClaimProofResult): Promise<SubmitClaimResult> => {
      const client = createLocalLumenClient(snapshot.campaign, snapshot);
      const result = await client.submitClaim(proofResult.publicInputs, proofResult.proof);
      persist(client.exportSnapshot());
      return result;
    },
    [persist, snapshot]
  );

  return {
    ready,
    snapshot,
    campaign: snapshot.campaign,
    stats: snapshot.stats,
    events: snapshot.events,
    recipients: demoRecipients,
    tree,
    complianceTree,
    resetDemo,
    createCampaign,
    updateCampaign,
    generateProof,
    submitProof
  };
}
