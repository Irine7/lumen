"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, Save, Trees } from "lucide-react";
import type { CampaignConfig } from "@lumen-aid/shared";
import { Button, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";
import { fetchActiveTestnetConfig, type ActiveTestnetConfigResult } from "@/lib/testnet-active";

export function OperatorClient() {
  const { campaign, createCampaign, resetDemo, tree, complianceTree, ready } = useLumenDemo();
  const [draft, setDraft] = useState<CampaignConfig>(campaign);
  const [saved, setSaved] = useState(false);
  const [activeTestnet, setActiveTestnet] = useState<ActiveTestnetConfigResult>({
    status: "not_configured",
    message: "Loading active payout campaign"
  });

  useEffect(() => {
    setDraft(campaign);
  }, [campaign]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveTestnetConfig()
      .then((result) => {
        if (!cancelled) {
          setActiveTestnet(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActiveTestnet({
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function submit() {
    createCampaign(draft);
    setSaved(true);
  }

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Active payout campaign"
          description="Read-only public testnet operations view."
          action={
            activeTestnet.status === "ready" ? (
              <StatusDot tone="green" label="Ready for payout claims" />
            ) : (
              <StatusDot tone="amber" label="Not ready" />
            )
          }
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot
              tone={activeTestnet.status === "ready" ? "green" : activeTestnet.status === "error" ? "red" : "amber"}
              label={activeTestnet.status === "ready" ? "Fresh payout command" : "Active campaign unavailable"}
            />
            <p className="mt-3 break-all font-mono text-xs leading-5 text-[#d8e7ec]">
              pnpm stellar:fresh-payout-campaign:testnet
            </p>
            {activeTestnet.status !== "ready" ? (
              <p className="mt-3 text-sm leading-6 text-[#93a4ad]">{activeTestnet.message}</p>
            ) : null}
          </div>

          {activeTestnet.status === "ready" ? (
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Database className="h-4 w-4 text-[#51d6ff]" />
                Testnet escrow
              </div>
              <dl>
                <KeyValue label="Campaign contract" value={activeTestnet.active.campaignContractId} />
                <KeyValue label="Asset code" value={activeTestnet.active.assetCode ?? "testnet asset"} />
                <KeyValue
                  label="Asset contract"
                  value={activeTestnet.active.assetContractId ?? activeTestnet.active.mockTokenContractId ?? "missing"}
                />
                <KeyValue label="Escrow funded" value={activeTestnet.active.escrowFunded ?? "unread"} />
                <KeyValue label="Budget" value={activeTestnet.active.budget} />
                <KeyValue label="Per-recipient cap" value={activeTestnet.active.perRecipientCap} />
              </dl>
            </div>
          ) : null}
        </div>
        {activeTestnet.status === "ready" ? (
          <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
            {activeTestnet.active.recipients.map((recipient) => (
              <div key={recipient.id} className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
                <StatusDot
                  tone={recipient.eligible && recipient.compliant !== false ? "green" : recipient.eligible ? "amber" : "red"}
                  label={`${recipient.displayName} ${
                    recipient.eligible && recipient.compliant !== false
                      ? "eligible + cleared"
                      : recipient.eligible
                        ? "eligible, not cleared"
                        : "ineligible"
                  }`}
                />
                <p className="mt-3 break-all font-mono text-xs leading-5 text-[#93a4ad]">
                  {recipient.payoutAddress ?? "no payout address"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

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
            Compliance clearance root
            <div className="flex gap-2">
              <input
                value={draft.complianceRoot}
                onChange={(event) => update("complianceRoot", event.target.value as CampaignConfig["complianceRoot"])}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 font-mono text-xs text-white outline-none focus:border-[#51d6ff]"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => update("complianceRoot", complianceTree.root)}
                aria-label="Load demo compliance root"
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
          <KeyValue label="Compliance root" value={draft.complianceRoot} />
          <KeyValue label="Deny root" value={draft.denyRoot ?? "future extension"} />
          <KeyValue label="Policy hash" value={draft.policyHash} />
          <KeyValue label="Verifier" value={draft.verifier} />
        </dl>
      </Panel>
      </div>
    </div>
  );
}
