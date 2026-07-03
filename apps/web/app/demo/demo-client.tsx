"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileCheck2,
  HandCoins,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import {
  Button,
  DisclosureBanner,
  InfoCard,
  KeyValue,
  MetricCard,
  Panel,
  StatusPill,
  TechnicalDetails
} from "@/components/ui";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";
import { formatAmount, shortenAddress } from "@/lib/format";

const PROGRESS_KEY = "lumen-demo-progress-v1";
const AUDIT_PACKAGE_KEY = "lumen-demo-audit-package";

const steps = [
  "Check campaign and AIDUSD escrow",
  "Claim as Dora",
  "Try Dora duplicate",
  "Try Eve non-compliant",
  "Try Mallory ineligible",
  "View donor dashboard",
  "Open auditor disclosure"
];

const panels = [
  {
    title: "Operator",
    href: "/operator",
    icon: ShieldCheck,
    action: "Review active roots, verifier, and escrow readiness."
  },
  {
    title: "Recipient",
    href: "/recipient",
    icon: HandCoins,
    action: "Generate Dora proof, submit, then show expected rejections."
  },
  {
    title: "Donor",
    href: "/donor",
    icon: LayoutDashboard,
    action: "Show live campaign accounting and public commitments."
  },
  {
    title: "Auditor",
    href: "/auditor",
    icon: FileCheck2,
    action: "Inspect the demo-only selective disclosure package."
  }
];

function readProgress(): boolean[] {
  if (typeof window === "undefined") {
    return steps.map(() => false);
  }

  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) {
    return steps.map(() => false);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return steps.map(() => false);
    }
    return steps.map((_, index) => Boolean(parsed[index]));
  } catch {
    return steps.map(() => false);
  }
}

function metricValue(value: number | undefined, fallback = "Pending live read"): string {
  return value === undefined ? fallback : value.toString();
}

function cleanReason(state: ActiveTestnetState | null): string {
  if (!state) {
    return "Live state has not been loaded yet.";
  }
  return state.error ?? state.computed.statusMessage;
}

export function DemoClient() {
  const [testnetState, setTestnetState] = useState<ActiveTestnetState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [progress, setProgress] = useState<boolean[]>(() => steps.map(() => false));
  const [hasAuditPackage, setHasAuditPackage] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
    setHasAuditPackage(Boolean(window.localStorage.getItem(AUDIT_PACKAGE_KEY)));
  }, []);

  useEffect(() => {
    refreshState().catch(() => undefined);
  }, []);

  async function refreshState() {
    setStateLoading(true);
    try {
      setTestnetState(await fetchActiveTestnetState());
    } catch (error) {
      setTestnetState({
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
    } finally {
      setStateLoading(false);
    }
  }

  function setStep(index: number, value: boolean) {
    const next = progress.map((current, currentIndex) =>
      currentIndex === index ? value : current
    );
    setProgress(next);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }

  function resetProgress() {
    const next = steps.map(() => false);
    setProgress(next);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }

  const active = testnetState?.ok ? testnetState.deployment : null;
  const live = testnetState?.mode === "live" ? testnetState.live : undefined;
  const verifierMode = testnetState?.live?.verifierMode ?? active?.verifierMode;
  const campaignStateValue = testnetState?.computed.campaignState ?? "unknown";
  const campaignStateLabel =
    campaignStateValue === "partially_used"
      ? "partially used"
      : campaignStateValue;
  const stateTone =
    campaignStateValue === "pristine"
      ? "green"
      : campaignStateValue === "unavailable"
        ? "amber"
        : campaignStateValue === "unknown"
          ? "amber"
          : "amber";
  const completed = progress.filter(Boolean).length;
  const liveUnavailable =
    Boolean(testnetState) &&
    (testnetState?.mode === "metadata_only" || testnetState?.mode === "error");

  const panelStatus = useMemo(() => {
    if (!active) {
      return {
        Operator: stateLoading ? "Reading state" : "Waiting for state",
        Recipient: stateLoading ? "Reading state" : "Waiting for state",
        Donor: stateLoading ? "Reading state" : "Waiting for state",
        Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
      };
    }

    return {
      Operator: `${active.assetCode || "AIDUSD"} campaign ready`,
      Recipient: "Real testnet claim ready",
      Donor: testnetState?.mode === "live" ? "Live state ready" : "Metadata loaded",
      Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
    };
  }, [active, hasAuditPackage, stateLoading, testnetState?.mode]);

  return (
    <div data-testid="demo-command-center" className="grid gap-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={active ? "green" : "amber"}>
                {active
                  ? "Active AIDUSD testnet deployment configured"
                  : stateLoading
                    ? "Reading active deployment"
                    : "Deployment state pending"}
              </StatusPill>
              <StatusPill tone={stateTone}>
                Campaign state: {stateLoading && !testnetState ? "reading" : campaignStateLabel}
              </StatusPill>
              <StatusPill tone={verifierMode === "real_groth16" ? "green" : "amber"}>
                Verifier mode: {verifierMode ?? (stateLoading ? "reading" : "metadata pending")}
              </StatusPill>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Demo command center
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#bac9cf]">
              Run the validated Lumen flow from one polished launch point.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => refreshState().catch(() => undefined)}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh state
            </Button>
            <Button type="button" variant="secondary" onClick={resetProgress}>
              <RefreshCw className="h-4 w-4" />
              Reset local checklist
            </Button>
          </div>
        </div>

        <div className="grid gap-5 border-t border-white/10 p-5 lg:grid-cols-[0.92fr_1.08fr] lg:p-6">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Campaign"
                value={active ? "Ready" : stateLoading ? "Reading" : "Pending"}
                tone={active ? "green" : "amber"}
                detail={active ? active.campaignContractId && shortenAddress(active.campaignContractId) : undefined}
              />
              <MetricCard
                label="AIDUSD escrow"
                value={formatAmount(live?.escrowBalance ?? active?.escrowFunded, active?.assetCode || "AIDUSD")}
                tone="green"
                detail={active ? "Escrow funded" : "Waiting for deployment metadata"}
              />
              <MetricCard
                label="Verifier"
                value={verifierMode ?? "Pending"}
                tone={verifierMode === "real_groth16" ? "green" : "amber"}
              />
              <MetricCard
                label="Readiness"
                value={testnetState?.computed.readyForFullDemo ? "Ready" : active ? "Review state" : "Pending"}
                tone={testnetState?.computed.readyForFullDemo ? "green" : "amber"}
                detail={testnetState?.computed.statusMessage ?? "Waiting for live state"}
              />
            </div>

            {liveUnavailable ? (
              <DisclosureBanner title="Live state unavailable" tone="amber">
                Reason: {cleanReason(testnetState)} Metadata loaded from active deployment.
              </DisclosureBanner>
            ) : (
              <DisclosureBanner title="Ready for full demo sequence" tone="cyan">
                {testnetState?.computed.statusMessage ?? "Refresh state to confirm live campaign readiness."}
              </DisclosureBanner>
            )}

            <TechnicalDetails title="View deployment details">
              <dl className="grid gap-x-6 md:grid-cols-2">
                <KeyValue label="Asset" value={active?.assetCode || "AIDUSD"} />
                <KeyValue label="Campaign state" value={campaignStateLabel} />
                <KeyValue label="Claim count" value={metricValue(live?.claimCount)} />
                <KeyValue label="Total claimed" value={metricValue(live?.totalClaimed)} />
                <KeyValue label="Remaining budget" value={metricValue(live?.remainingBudget)} />
                <KeyValue label="Remaining escrow" value={metricValue(live?.escrowBalance)} />
                <KeyValue label="Campaign contract" value={active?.campaignContractId} />
                <KeyValue label="Verifier contract" value={active?.verifierContractId} />
                <KeyValue label="Campaign ID" value={active?.campaignId} />
                <KeyValue label="Eligibility root" value={active?.eligibilityRoot} />
                <KeyValue label="Compliance root" value={active?.complianceRoot} />
                <KeyValue label="Policy hash" value={active?.policyHash} />
              </dl>
            </TechnicalDetails>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusPill tone={completed === steps.length ? "green" : "cyan"}>
                {completed}/{steps.length} demo steps checked
              </StatusPill>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9fb0bb]">
                Video checklist
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {steps.map((step, index) => {
                const done = progress[index] ?? false;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setStep(index, !done)}
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#071012] px-3 py-2 text-left text-sm text-[#dce7eb] transition hover:border-white/20 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/45"
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#78f1b2]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[#9fb0bb]" />
                    )}
                    <span>
                      {index + 1}. {step}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {panels.map((panel) => {
          const Icon = panel.icon;
          const status = panelStatus[panel.title as keyof typeof panelStatus];
          const tone = /Waiting|Reading/.test(status) ? "amber" : "green";
          return (
            <Panel key={panel.title}>
              <div className="grid h-full gap-4 p-5">
                <InfoCard title={panel.title} icon={Icon} tone="cyan" className="h-full">
                  {panel.action}
                </InfoCard>
                <StatusPill tone={tone}>{status}</StatusPill>
                <Link href={panel.href}>
                  <Button className="w-full" variant="secondary">
                    Open {panel.title}
                  </Button>
                </Link>
              </div>
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
