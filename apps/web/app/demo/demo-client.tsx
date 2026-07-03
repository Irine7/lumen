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
  InfoCard,
  MetricCard,
  Panel,
  StatusPill
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
    action: "Inspect the selective disclosure package."
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
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aebdc5]">
              Active campaign environment on Stellar testnet
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusPill tone={active ? "green" : "amber"}>
              {active ? "Connected" : stateLoading ? "Reading" : "Pending"}
            </StatusPill>
            <Button
              type="button"
              variant="secondary"
              onClick={() => refreshState().catch(() => undefined)}
              className="min-h-10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" variant="secondary" onClick={resetProgress}>
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Campaign ready"
            value={active ? "Ready" : stateLoading ? "Reading" : "Pending"}
            tone={active ? "green" : "amber"}
            detail={active ? "All conditions met" : "Waiting for deployment metadata"}
          />
          <MetricCard
            label="AIDUSD escrow funded"
            value={formatAmount(live?.escrowBalance ?? active?.escrowFunded, active?.assetCode || "AIDUSD")}
            tone="cyan"
            detail="Funded"
          />
          <MetricCard
            label="Verifier: real_groth16"
            value={verifierMode ?? "Pending"}
            tone={verifierMode === "real_groth16" ? "green" : "amber"}
            detail="Soroban on testnet"
          />
          <MetricCard
            label="State: pristine"
            value={stateLoading && !testnetState ? "Reading" : campaignStateLabel}
            tone={stateTone}
            detail={testnetState?.computed.readyForFullDemo ? "Ready" : "No claims yet"}
          />
        </div>

        <div className="grid gap-4 border-t border-white/10 p-5 lg:grid-cols-[0.72fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-[#101b24]/70 p-4">
            <h2 className="text-sm font-semibold text-white">Campaign overview</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <dt className="text-[#9fb0bb]">Campaign</dt>
                <dd className="text-[#dce7eb]">Disaster Relief - Region 7</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <dt className="text-[#9fb0bb]">Escrow</dt>
                <dd className="font-mono text-[#dce7eb]">
                  {active?.campaignContractId ? shortenAddress(active.campaignContractId) : "Pending"}
                </dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <dt className="text-[#9fb0bb]">Token</dt>
                <dd className="text-[#dce7eb]">{active?.assetCode || "AIDUSD"} (testnet)</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <dt className="text-[#9fb0bb]">Budget</dt>
                <dd className="text-[#dce7eb]">
                  {formatAmount(active?.budget ?? live?.remainingBudget, active?.assetCode || "AIDUSD")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101b24]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Recent activity</h2>
              <StatusPill tone={completed === steps.length ? "green" : "cyan"}>
                {completed}/{steps.length} checked
              </StatusPill>
            </div>
            <div className="mt-4 grid gap-2">
              {steps.slice(0, 5).map((step, index) => {
                const done = progress[index] ?? false;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setStep(index, !done)}
                    className="flex min-h-10 items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-[#dce7eb] transition hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/45"
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#78f1b2]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[#9fb0bb]" />
                    )}
                    <span>
                      {step}
                    </span>
                    <span className="ml-auto text-xs text-[#9fb0bb]">{index + 2}m ago</span>
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
