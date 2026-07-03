"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw, Save, TerminalSquare, Trees, WalletCards } from "lucide-react";
import type { CampaignConfig } from "@lumen-aid/shared";
import {
  Button,
  CodeBlock,
  DisclosureBanner,
  InfoCard,
  KeyValue,
  MetricCard,
  Panel,
  PanelHeader,
  StatusDot,
  StatusPill,
  TechnicalDetails
} from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";
import { formatAmount, shortenAddress } from "@/lib/format";

const freshCampaignCommand = "pnpm stellar:fresh-aidusd-campaign:testnet";

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
              campaignState: "unavailable",
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
  const assetCode = active?.assetCode || "AIDUSD";
  const verifierMode = live?.verifierMode ?? active?.verifierMode;
  const campaignState = activeTestnet?.computed.campaignState ?? "pending";

  return (
    <div className="grid gap-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={active ? "green" : "amber"}>
                {active ? "Active campaign configured" : "Reading active campaign"}
              </StatusPill>
              <StatusPill tone="cyan">{assetCode}/SAC</StatusPill>
              <StatusPill tone={verifierMode === "real_groth16" ? "green" : "amber"}>
                Verifier: {verifierMode ?? "pending"}
              </StatusPill>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Campaign operator
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#bac9cf]">
              Manage the active AIDUSD campaign configuration and readiness.
            </p>
          </div>
          <StatusDot
            tone={activeTestnet?.computed.readyForFullDemo ? "green" : active ? "amber" : "neutral"}
            label={activeTestnet?.computed.statusMessage ?? "Loading active testnet state"}
          />
        </div>
      </Panel>

      {activeTestnet?.mode === "metadata_only" || activeTestnet?.mode === "error" ? (
        <DisclosureBanner title="Live read unavailable" tone={activeTestnet.mode === "error" ? "red" : "amber"}>
          Metadata loaded from active deployment. Reason:{" "}
          {activeTestnet.error ?? activeTestnet.computed.statusMessage}
        </DisclosureBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Campaign state"
          value={campaignState === "partially_used" ? "Partially used" : campaignState}
          tone={campaignState === "pristine" ? "green" : "amber"}
        />
        <MetricCard
          label="Escrow funded"
          value={formatAmount(active?.escrowFunded, assetCode)}
          tone="green"
        />
        <MetricCard
          label="Remaining escrow"
          value={formatAmount(live?.escrowBalance ?? active?.escrowFunded, assetCode)}
        />
        <MetricCard label="Claim count" value={live?.claimCount?.toString() ?? "Pending live read"} />
        <MetricCard
          label="Verifier mode"
          value={verifierMode ?? "Pending live read"}
          tone={verifierMode === "real_groth16" ? "green" : "amber"}
        />
        <MetricCard
          label="Campaign contract"
          value={shortenAddress(active?.campaignContractId)}
          tone="cyan"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel>
          <PanelHeader title="Campaign readiness" description="Operator-facing checks for the active campaign." />
          <div className="grid gap-4 p-5">
            <InfoCard title="Active AIDUSD escrow" icon={WalletCards} tone="green">
              The active campaign is configured for {formatAmount(active?.escrowFunded, assetCode)}.
            </InfoCard>
            <InfoCard title="Read-only setup command" icon={TerminalSquare} tone="cyan">
              Use this only when intentionally preparing a fresh campaign for a new testnet run.
            </InfoCard>
            <CodeBlock value={freshCampaignCommand} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Active configuration" description="Concise public configuration for the active campaign." />
          <dl className="p-5">
            <KeyValue label="AIDUSD/SAC contract" value={active?.assetContractId} />
            <KeyValue label="Campaign contract" value={active?.campaignContractId} />
            <KeyValue label="Verifier contract" value={active?.verifierContractId} />
            <KeyValue label="Eligibility root" value={active?.eligibilityRoot} />
            <KeyValue label="Compliance root" value={active?.complianceRoot} />
            <KeyValue label="Policy hash" value={active?.policyHash} />
          </dl>
        </Panel>
      </div>

      <TechnicalDetails title="Campaign configuration controls">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {ready ? <StatusPill tone="green">Configuration ready</StatusPill> : null}
              {saved ? <StatusPill tone="green">Campaign saved</StatusPill> : null}
            </div>

            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Campaign name
              <input
                value={draft.name ?? ""}
                onChange={(event) => update("name", event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
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
                  className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[#d8e7ec]">
                Max claim amount
                <input
                  type="number"
                  min={1}
                  value={draft.perRecipientCap ?? 0}
                  onChange={(event) => update("perRecipientCap", Number(event.target.value))}
                  className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Stellar asset contract / issuer
              <input
                value={draft.asset ?? ""}
                onChange={(event) => update("asset", event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
              />
            </label>

            <label className="grid gap-2 text-sm text-[#d8e7ec]">
              Eligibility root
              <div className="flex gap-2">
                <input
                  value={draft.eligibilityRoot ?? ""}
                  onChange={(event) => update("eligibilityRoot", event.target.value as CampaignConfig["eligibilityRoot"])}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#071012] px-3 font-mono text-xs text-white outline-none focus:border-[#69e6cf]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => update("eligibilityRoot", tree.root)}
                  aria-label="Load eligibility root"
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
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#071012] px-3 font-mono text-xs text-white outline-none focus:border-[#69e6cf]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => update("complianceRoot", complianceTree.root)}
                  aria-label="Load compliance root"
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
                className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 font-mono text-xs text-white outline-none focus:border-[#69e6cf]"
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" onClick={submit}>
                <Save className="h-4 w-4" />
                Save campaign
              </Button>
              <Button type="button" variant="secondary" onClick={resetDemo}>
                <RefreshCw className="h-4 w-4" />
                Reset configuration
              </Button>
            </div>
          </div>

          <Panel className="bg-white/[0.025]">
            <PanelHeader title="Campaign config" />
            <dl className="p-5">
              <KeyValue label="Campaign ID" value={draft.campaignId} />
              <KeyValue label="Asset" value={draft.asset} />
              <KeyValue label="Budget" value={draft.budget} />
              <KeyValue label="Per-recipient cap" value={draft.perRecipientCap} />
              <KeyValue label="Eligibility root" value={draft.eligibilityRoot} />
              <KeyValue label="Compliance root" value={draft.complianceRoot} />
              <KeyValue label="Policy hash" value={draft.policyHash} />
              <KeyValue label="Verifier" value={draft.verifier} />
            </dl>
          </Panel>
        </div>
      </TechnicalDetails>

      <DisclosureBanner title="Disclosure" tone="amber">
        This screen shows public testnet metadata and campaign controls. It does not expose
        private keys, source account secrets, or recipient witness material.
      </DisclosureBanner>
    </div>
  );
}
