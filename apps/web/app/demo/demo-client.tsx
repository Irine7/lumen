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
import { Button, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";

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

function liveValue(value: number | undefined, unavailableReason: string): string {
  return value === undefined ? unavailableReason : value.toString();
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
          campaignState: "unread",
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
  const unavailableReason =
    testnetState?.mode === "metadata_only"
      ? `unavailable: ${testnetState.error ?? "live read failed"}`
      : testnetState?.mode === "error"
        ? `unavailable: ${testnetState.error ?? "state read failed"}`
        : stateLoading
          ? "reading"
          : "unavailable";
  const campaignState = useMemo(() => {
    if (!testnetState) {
      return {
        label: stateLoading ? "Campaign state: reading" : "Campaign state: unread",
        value: stateLoading ? "reading" : "unread",
        tone: "amber" as const,
        readiness: stateLoading ? "Reading active testnet state." : "Live state has not been loaded yet.",
        recipientStatus:
          "Per-recipient claim status is inferred from aggregate state and demo fixture only."
      };
    }

    const state = testnetState.computed.campaignState;
    const liveUnavailable = testnetState.mode === "metadata_only" || testnetState.mode === "error";

    return {
      label:
        state === "pristine"
          ? "Campaign state: pristine"
          : state === "partially_used"
            ? "Campaign state: partially used"
            : state === "consumed"
              ? "Campaign state: consumed"
              : `Campaign state: unread (${testnetState.error ?? "live read unavailable"})`,
      value: state,
      tone:
        state === "pristine"
          ? ("green" as const)
          : testnetState.mode === "error"
            ? ("red" as const)
            : ("amber" as const),
      readiness: liveUnavailable
        ? testnetState.computed.statusMessage
        : testnetState.computed.statusMessage,
      recipientStatus:
        "Per-recipient claim status is inferred from aggregate state and demo fixture only."
    };
  }, [stateLoading, testnetState]);
  const completed = progress.filter(Boolean).length;
  const panelStatus = useMemo(() => {
    if (!active) {
      return {
        Operator: stateLoading ? "Reading state" : "Unavailable",
        Recipient: stateLoading ? "Reading state" : "Unavailable",
        Donor: stateLoading ? "Reading state" : "Unavailable",
        Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
      };
    }

    return {
      Operator: `${active.assetCode || "Asset"} campaign ready`,
      Recipient: "Real Testnet Claim ready",
      Donor: testnetState?.mode === "live" ? "Live AIDUSD state ready" : "Metadata loaded",
      Auditor: hasAuditPackage ? "Package available" : "Waiting for package"
    };
  }, [active, hasAuditPackage, stateLoading, testnetState?.mode]);

  return (
    <div data-testid="demo-command-center" className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Demo command center"
          description="A guided launcher for the validated product flow."
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => refreshState().catch(() => undefined)}>
                <RefreshCw className="h-4 w-4" />
                Refresh state
              </Button>
              <Button type="button" variant="secondary" onClick={resetProgress}>
                <RefreshCw className="h-4 w-4" />
                Reset progress
              </Button>
            </div>
          }
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot
              tone={
                testnetState?.mode === "live"
                  ? "green"
                  : testnetState?.mode === "error"
                    ? "red"
                    : active
                      ? "amber"
                      : "amber"
              }
              label={
                active
                  ? "Active AIDUSD testnet deployment configured"
                  : stateLoading
                    ? "Reading active AIDUSD testnet deployment"
                    : "Active testnet deployment unavailable"
              }
            />
            <dl className="mt-4">
              <KeyValue label="Asset" value={active?.assetCode || "not loaded"} />
              <KeyValue label="Campaign contract" value={active?.campaignContractId || "not loaded"} />
              <KeyValue
                label="Verifier mode"
                value={live?.verifierMode ?? (active ? "metadata loaded, verifier live read optional" : "not loaded")}
              />
              <KeyValue label="Campaign state" value={campaignState.value} />
              <KeyValue label="Claim count" value={liveValue(live?.claimCount, unavailableReason)} />
              <KeyValue label="Total claimed" value={liveValue(live?.totalClaimed, unavailableReason)} />
              <KeyValue label="Remaining budget" value={liveValue(live?.remainingBudget, unavailableReason)} />
              <KeyValue label="Remaining escrow" value={liveValue(live?.escrowBalance, unavailableReason)} />
              <KeyValue label="Eligibility root" value={active?.eligibilityRoot || "not loaded"} />
              <KeyValue label="Compliance root" value={active?.complianceRoot || "not loaded"} />
              <KeyValue
                label="Status"
                value={testnetState?.computed.statusMessage ?? (stateLoading ? "reading" : "not loaded")}
              />
            </dl>
            <div className="mt-4 rounded-lg border border-[#26313d] bg-[#080b0f] p-3">
              {testnetState?.mode === "metadata_only" ? (
                <StatusDot tone="amber" label="Campaign metadata loaded" />
              ) : (
                <StatusDot tone={campaignState.tone} label={campaignState.label} />
              )}
              <p className="mt-2 text-sm leading-6 text-[#d8e7ec]">
                {testnetState?.mode === "metadata_only"
                  ? `Live stats unavailable: ${testnetState.error ?? "unknown read failure"}`
                  : campaignState.readiness}
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
                  tone={
                    /Unavailable|Reading/.test(panelStatus[panel.title as keyof typeof panelStatus])
                      ? "amber"
                      : "green"
                  }
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
