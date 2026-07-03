"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCampaignEscrowBalance,
  getCampaignStats,
  type StellarReadResult,
  type TestnetCampaignStats,
  type TestnetEscrowBalance
} from "@lumen-aid/stellar";
import {
  CheckCircle2,
  Circle,
  FileCheck2,
  HandCoins,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { Button, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";
import {
  activeToStellarEnv,
  fetchActiveTestnetConfig,
  type ActiveTestnetConfigResult
} from "@/lib/testnet-active";

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
    action: "Check campaign roots and AIDUSD escrow."
  },
  {
    title: "Recipient",
    href: "/recipient",
    icon: HandCoins,
    action: "Generate Dora proof, submit, then try duplicate/Eve/Mallory."
  },
  {
    title: "Donor",
    href: "/donor",
    icon: LayoutDashboard,
    action: "Refresh live AIDUSD state and latest tx."
  },
  {
    title: "Auditor",
    href: "/auditor",
    icon: FileCheck2,
    action: "Load the local demo disclosure package."
  }
];

type CampaignReadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      stats: StellarReadResult<TestnetCampaignStats>;
      escrow: StellarReadResult<TestnetEscrowBalance>;
    }
  | { status: "error"; message: string };

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
  const [activeResult, setActiveResult] = useState<ActiveTestnetConfigResult>({
    status: "not_configured",
    message: "Loading active testnet deployment"
  });
  const [progress, setProgress] = useState<boolean[]>(() => steps.map(() => false));
  const [hasAuditPackage, setHasAuditPackage] = useState(false);
  const [campaignRead, setCampaignRead] = useState<CampaignReadState>({ status: "idle" });

  useEffect(() => {
    setProgress(readProgress());
    setHasAuditPackage(Boolean(window.localStorage.getItem(AUDIT_PACKAGE_KEY)));
  }, []);

  useEffect(() => {
    fetchActiveTestnetConfig()
      .then(setActiveResult)
      .catch((error) =>
        setActiveResult({
          status: "error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
  }, []);

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

  const active = activeResult.status === "ready" ? activeResult.active : null;

  useEffect(() => {
    if (!active) {
      setCampaignRead({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCampaignRead({ status: "loading" });
    const env = activeToStellarEnv(active);
    Promise.all([getCampaignStats(env), getCampaignEscrowBalance(env)])
      .then(([stats, escrow]) => {
        if (!cancelled) {
          setCampaignRead({ status: "loaded", stats, escrow });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCampaignRead({
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  const stats =
    campaignRead.status === "loaded" && campaignRead.stats.status === "ready"
      ? campaignRead.stats.data
      : null;
  const escrow =
    campaignRead.status === "loaded" && campaignRead.escrow.status === "ready"
      ? campaignRead.escrow.data
      : null;
  const claimCount = stats?.claimCount ?? null;
  const remainingEscrow = escrow?.balance ?? null;
  const campaignState = useMemo(() => {
    if (claimCount === null) {
      return {
        label: campaignRead.status === "loading" ? "Campaign state: reading" : "Campaign state: unread",
        value: campaignRead.status === "loading" ? "reading" : "unread",
        tone: "amber" as const,
        readiness: "Claim count is not readable yet.",
        recipientStatus: "Per-recipient claim status is not shown without a direct contract read."
      };
    }

    if (claimCount === 0) {
      return {
        label: "Campaign state: pristine",
        value: "pristine",
        tone: "green" as const,
        readiness: "Ready for full demo sequence",
        recipientStatus: "Only aggregate claim count is readable here; no recipient has claimed when claim count is 0."
      };
    }

    const consumed =
      (stats && BigInt(stats.remainingBudget) <= 0n) ||
      (remainingEscrow !== null && BigInt(remainingEscrow) <= 0n);

    return {
      label: consumed ? "Campaign state: consumed" : "Campaign state: partially used",
      value: consumed ? "consumed" : "partially used",
      tone: consumed ? ("red" as const) : ("amber" as const),
      readiness:
        "This campaign has already been used. Run pnpm judge:prepare-demo:testnet for a pristine demo.",
      recipientStatus:
        "Only aggregate claim count is readable here; per-recipient claim status is not shown."
    };
  }, [campaignRead.status, claimCount, remainingEscrow, stats]);
  const completed = progress.filter(Boolean).length;
  const panelStatus = useMemo(() => {
    if (!active) {
      return {
        Operator: "Not configured",
        Recipient: "Not configured",
        Donor: "Not configured",
        Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
      };
    }

    return {
      Operator: `${active.assetCode ?? "Asset"} campaign ready`,
      Recipient: "Real Testnet Claim ready",
      Donor: "Live AIDUSD state default",
      Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
    };
  }, [active, hasAuditPackage]);

  return (
    <div data-testid="demo-command-center" className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Demo command center"
          description="A guided launcher for the validated product flow."
          action={
            <Button type="button" variant="secondary" onClick={resetProgress}>
              <RefreshCw className="h-4 w-4" />
              Reset progress
            </Button>
          }
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot
              tone={active ? "green" : activeResult.status === "error" ? "red" : "amber"}
              label={active ? "Active AIDUSD testnet deployment configured" : "Active testnet not configured"}
            />
            <dl className="mt-4">
              <KeyValue label="Asset" value={active?.assetCode ?? "not configured"} />
              <KeyValue label="Campaign contract" value={active?.campaignContractId ?? "not configured"} />
              <KeyValue label="Verifier mode" value={active?.verifierInfo.mode ?? "not configured"} />
              <KeyValue label="Campaign state" value={campaignState.value} />
              <KeyValue label="Claim count" value={claimCount === null ? "unread" : claimCount.toString()} />
              <KeyValue label="Remaining escrow" value={remainingEscrow ?? "unread"} />
              <KeyValue label="Eligibility root" value={active?.eligibilityRoot ?? "not configured"} />
              <KeyValue label="Compliance root" value={active?.complianceRoot ?? "not configured"} />
              <KeyValue
                label="Status message"
                value={activeResult.status === "ready" ? "ready" : activeResult.message}
              />
            </dl>
            <div className="mt-4 rounded-lg border border-[#26313d] bg-[#080b0f] p-3">
              <StatusDot tone={campaignState.tone} label={campaignState.label} />
              <p className="mt-2 text-sm leading-6 text-[#d8e7ec]">
                {campaignState.readiness}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#93a4ad]">
                {campaignState.recipientStatus}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot tone={completed === steps.length ? "green" : "cyan"} label={`${completed}/${steps.length} demo steps checked`} />
            <div className="mt-4 grid gap-2">
              {steps.map((step, index) => {
                const done = progress[index] ?? false;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setStep(index, !done)}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-[#26313d] bg-[#080b0f] px-3 py-2 text-left text-sm text-[#d8e7ec] transition hover:border-[#3b4a58]"
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5df0a3]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[#93a4ad]" />
                    )}
                    <span>{index + 1}. {step}</span>
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
          return (
            <Panel key={panel.title}>
              <div className="grid gap-4 p-5">
                <Icon className="h-5 w-5 text-[#51d6ff]" />
                <div>
                  <h2 className="text-lg font-semibold text-white">{panel.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#93a4ad]">{panel.action}</p>
                </div>
                <StatusDot
                  tone={panelStatus[panel.title as keyof typeof panelStatus].includes("Not configured") ? "amber" : "green"}
                  label={panelStatus[panel.title as keyof typeof panelStatus]}
                />
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
