"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, Trees } from "lucide-react";
import type { CampaignConfig } from "@lumen-aid/shared";
import { Button, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";

export function OperatorClient() {
  const { campaign, createCampaign, resetDemo, tree, ready } = useLumenDemo();
  const [draft, setDraft] = useState<CampaignConfig>(campaign);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(campaign);
  }, [campaign]);

  function update<K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function submit() {
    createCampaign(draft);
    setSaved(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel>
        <PanelHeader
          title="Create aid campaign"
          description="Set the public policy, budget, cap, asset, and eligibility root committed on Soroban."
          action={ready ? <StatusDot tone="green" label="Localnet demo ready" /> : null}
        />
        <div className="grid gap-4 p-5">
          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Campaign name
            <input
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Total budget
              <input
                type="number"
                min={1}
                value={draft.budget}
                onChange={(event) => update("budget", Number(event.target.value))}
                className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
              />
            </label>
            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Max claim amount
              <input
                type="number"
                min={1}
                value={draft.perRecipientCap}
                onChange={(event) => update("perRecipientCap", Number(event.target.value))}
                className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Stellar asset contract / issuer
            <input
              value={draft.asset}
              onChange={(event) => update("asset", event.target.value)}
              className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Eligibility root
            <div className="flex gap-2">
              <input
                value={draft.eligibilityRoot}
                onChange={(event) => update("eligibilityRoot", event.target.value as CampaignConfig["eligibilityRoot"])}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 font-mono text-xs text-white outline-none focus:border-[#51d6ff]"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => update("eligibilityRoot", tree.root)}
                aria-label="Load demo eligibility root"
              >
                <Trees className="h-4 w-4" />
              </Button>
            </div>
          </label>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Policy hash
            <input
              value={draft.policyHash}
              onChange={(event) => update("policyHash", event.target.value as CampaignConfig["policyHash"])}
              className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 font-mono text-xs text-white outline-none focus:border-[#51d6ff]"
            />
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" onClick={submit}>
              <Save className="h-4 w-4" />
              Save campaign
            </Button>
            <Button type="button" variant="secondary" onClick={resetDemo}>
              <RefreshCw className="h-4 w-4" />
              Reset demo
            </Button>
            {saved ? <StatusDot tone="green" label="Campaign written to local Soroban state" /> : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Campaign config"
          description="This is the public configuration the campaign contract enforces."
        />
        <dl className="p-5">
          <KeyValue label="Campaign ID" value={draft.campaignId} />
          <KeyValue label="Operator" value={draft.operator} />
          <KeyValue label="Asset" value={draft.asset} />
          <KeyValue label="Budget" value={draft.budget} />
          <KeyValue label="Per-recipient cap" value={draft.perRecipientCap} />
          <KeyValue label="Eligibility root" value={draft.eligibilityRoot} />
          <KeyValue label="Deny root" value={draft.denyRoot ?? "future extension"} />
          <KeyValue label="Policy hash" value={draft.policyHash} />
          <KeyValue label="Verifier" value={draft.verifier} />
        </dl>
      </Panel>
    </div>
  );
}
