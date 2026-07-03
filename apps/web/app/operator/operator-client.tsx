"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, Save, Trees } from "lucide-react";
import type { CampaignConfig } from "@lumen-aid/shared";
import { Button, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";

export function OperatorClient() {
  const { campaign, createCampaign, resetDemo, tree, complianceTree, ready } = useLumenDemo();
  const [draft, setDraft] = useState<CampaignConfig>(campaign);
  const [saved, setSaved] = useState(false);
  const [activeTestnet, setActiveTestnet] = useState<ActiveTestnetState | null>(null);

  useEffect(() => {
    setDraft(campaign);
  }, [campaign]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveTestnetState()
      .then((result) => {
        if (!cancelled) {
          setActiveTestnet(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActiveTestnet({
            ok: false,
            mode: "error",
            error: error instanceof Error ? error.message : String(error),
            deployment: {
              assetMode: "",
              assetCode: "",
              assetContractId: "",
              campaignContractId: "",
              verifierContractId: "",
              campaignId: "",
              eligibilityRoot: "",
              complianceRoot: "",
              policyHash: "",
              verificationKeyHash: "",
              budget: "",
              escrowFunded: "",
              perRecipientCap: ""
            },
            computed: {
              campaignState: "unread",
              readyForFullDemo: false,
              statusMessage: error instanceof Error ? error.message : String(error)
            }
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

  const active = activeTestnet?.ok ? activeTestnet.deployment : null;
  const live = activeTestnet?.mode === "live" ? activeTestnet.live : undefined;

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Active AIDUSD campaign"
          description="Read-only public testnet operations view."
          action={
            activeTestnet?.mode === "live" ? (
              <StatusDot tone="green" label="Active AIDUSD campaign" />
            ) : (
              <StatusDot tone={activeTestnet?.mode === "error" ? "red" : "amber"} label="Active state pending" />
            )
          }
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot
              tone={active ? "green" : activeTestnet?.mode === "error" ? "red" : "amber"}
              label={active ? "Fresh demo command" : "Active campaign unavailable"}
            />
            <p className="mt-3 break-all font-mono text-xs leading-5 text-[#d8e7ec]">
              pnpm judge:prepare-demo:testnet
            </p>
            {!active ? (
              <p className="mt-3 text-sm leading-6 text-[#93a4ad]">
                {activeTestnet?.computed.statusMessage ?? "Loading active AIDUSD campaign"}
              </p>
            ) : null}
          </div>

          {active ? (
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Database className="h-4 w-4 text-[#51d6ff]" />
                Testnet escrow
              </div>
              <dl>
                <KeyValue label="AIDUSD/SAC contract" value={active.assetContractId} />
                <KeyValue label="Campaign contract" value={active.campaignContractId} />
                <KeyValue label="Verifier contract" value={active.verifierContractId} />
                <KeyValue label="Asset code" value={active.assetCode} />
                <KeyValue label="Escrow funded" value={active.escrowFunded} />
                <KeyValue label="Actual token / escrow balance" value={live?.actualTokenBalance ?? live?.escrowBalance ?? activeTestnet?.error ?? "live read unavailable"} />
                <KeyValue label="Budget" value={active.budget} />
                <KeyValue label="Per-recipient cap" value={active.perRecipientCap} />
              </dl>
            </div>
          ) : null}
        </div>
        {active ? (
          <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
            <div className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
              <StatusDot
                tone={activeTestnet?.computed.readyForFullDemo ? "green" : "amber"}
                label={activeTestnet?.computed.statusMessage ?? "State loaded"}
              />
              <dl className="mt-4">
                <KeyValue label="Verifier mode" value={live?.verifierMode ?? activeTestnet?.error ?? "live read unavailable"} />
                <KeyValue label="Claim count" value={live?.claimCount ?? activeTestnet?.error ?? "live read unavailable"} />
                <KeyValue label="Remaining budget" value={live?.remainingBudget ?? activeTestnet?.error ?? "live read unavailable"} />
              </dl>
            </div>
            <div className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
              <StatusDot tone="cyan" label="Public roots and policy" />
              <dl className="mt-4">
                <KeyValue label="Eligibility root" value={active.eligibilityRoot} />
                <KeyValue label="Compliance root" value={active.complianceRoot} />
                <KeyValue label="Policy hash" value={active.policyHash} />
                <KeyValue label="Verification key hash" value={active.verificationKeyHash} />
              </dl>
            </div>
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
              value={draft.name ?? ""}
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
                value={draft.budget ?? 0}
                onChange={(event) => update("budget", Number(event.target.value))}
                className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
              />
            </label>
            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Max claim amount
              <input
                type="number"
                min={1}
                value={draft.perRecipientCap ?? 0}
                onChange={(event) => update("perRecipientCap", Number(event.target.value))}
                className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Stellar asset contract / issuer
            <input
              value={draft.asset ?? ""}
              onChange={(event) => update("asset", event.target.value)}
              className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Eligibility root
            <div className="flex gap-2">
              <input
                value={draft.eligibilityRoot ?? ""}
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
                value={draft.complianceRoot ?? ""}
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
              value={draft.policyHash ?? ""}
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
