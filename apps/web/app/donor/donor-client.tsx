"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, MonitorCog, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import {
  Button,
  DisclosureBanner,
  EmptyState,
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
import { formatAmount, formatStatus, shortenAddress } from "@/lib/format";

type DashboardMode = "testnet" | "demo";

type TestnetReadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; state: ActiveTestnetState };

type LastTx = {
  txHash: string;
  campaignContractId: string;
  payoutRecipient?: string;
  payoutAmount?: number;
  assetCode?: string;
  recipientBalanceAfter?: string | null;
  campaignEscrowAfter?: string | null;
  at: string;
};

const LAST_TX_STORAGE_KEY = "lumen-last-testnet-tx";

function readLastTx(): LastTx | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(LAST_TX_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LastTx;
  } catch {
    return null;
  }
}

function describeStateProblem(state: ActiveTestnetState | null): {
  tone: "amber" | "red";
  label: string;
  message: string;
} | null {
  if (!state || state.mode === "live") {
    return null;
  }

  if (state.mode === "metadata_only") {
    return {
      tone: "amber",
      label: "Live read unavailable",
      message: state.error ?? "Metadata loaded from active deployment. Live contract reads failed."
    };
  }

  return {
    tone: "red",
    label: "Live read unavailable",
    message: state.error ?? state.computed.statusMessage
  };
}

function valueOrPending(value: number | undefined): string {
  return value === undefined ? "Pending live read" : value.toString();
}

export function DonorClient() {
  const { campaign, stats, events, resetDemo } = useLumenDemo();
  const [mode, setMode] = useState<DashboardMode>("testnet");
  const [testnetState, setTestnetState] = useState<TestnetReadState>({ status: "idle" });
  const [lastTx, setLastTx] = useState<LastTx | null>(null);

  const refreshTestnet = useCallback(async (cancelled?: { value: boolean }) => {
    setTestnetState({ status: "loading" });
    const state = await fetchActiveTestnetState();
    if (cancelled?.value) {
      return;
    }
    setTestnetState({ status: "loaded", state });
  }, []);

  useEffect(() => {
    setLastTx(readLastTx());
  }, []);

  useEffect(() => {
    if (mode !== "testnet") {
      return;
    }

    const cancelled = { value: false };
    refreshTestnet(cancelled).catch((error) => {
      if (!cancelled.value) {
        setTestnetState({
          status: "loaded",
          state: {
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
          }
        });
      }
    });

    return () => {
      cancelled.value = true;
    };
  }, [mode, refreshTestnet]);

  useEffect(() => {
    function handleClaim() {
      setLastTx(readLastTx());
      if (mode === "testnet") {
        refreshTestnet().catch(() => undefined);
      }
    }

    window.addEventListener("lumen-testnet-claim", handleClaim);
    window.addEventListener("storage", handleClaim);
    return () => {
      window.removeEventListener("lumen-testnet-claim", handleClaim);
      window.removeEventListener("storage", handleClaim);
    };
  }, [mode, refreshTestnet]);

  const state = testnetState.status === "loaded" ? testnetState.state : null;
  const active = state?.ok ? state.deployment : null;
  const live = state?.mode === "live" ? state.live : undefined;
  const testnetProblem = useMemo(() => describeStateProblem(state), [state]);
  const assetCode = active?.assetCode || "AIDUSD";
  const verifierMode = live?.verifierMode ?? active?.verifierMode;

  return (
    <div className="grid gap-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={active ? "green" : "amber"}>
                {active ? "Escrow funded" : "Reading campaign metadata"}
              </StatusPill>
              <StatusPill tone={verifierMode === "real_groth16" ? "green" : "amber"}>
                Verifier: {verifierMode ?? "pending"}
              </StatusPill>
              <StatusPill tone="amber">Testnet prototype</StatusPill>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Campaign accountability
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#bac9cf]">
              Live public view of the active AIDUSD aid campaign.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <div className="flex rounded-2xl border border-white/10 bg-white/[0.035] p-1" role="group" aria-label="Dashboard mode">
              <Button
                type="button"
                variant={mode === "testnet" ? "primary" : "secondary"}
                onClick={() => setMode("testnet")}
                className="min-h-10"
              >
                <Database className="h-4 w-4" />
                Testnet
              </Button>
              <Button
                type="button"
                variant={mode === "demo" ? "primary" : "secondary"}
                onClick={() => setMode("demo")}
                className="min-h-10"
              >
                <MonitorCog className="h-4 w-4" />
                Local
              </Button>
            </div>
            {mode === "testnet" ? (
              <Button
                type="button"
                variant="secondary"
                data-testid="donor-refresh-button"
                onClick={() => refreshTestnet().catch(() => undefined)}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={resetDemo}>
                <RefreshCw className="h-4 w-4" />
                Reset local demo
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {mode === "testnet" ? (
        <>
          {testnetState.status === "loading" ? (
            <DisclosureBanner title="Reading live state" tone="cyan">
              Checking the active deployment through the read-only state endpoint.
            </DisclosureBanner>
          ) : null}

          {testnetProblem ? (
            <DisclosureBanner title={testnetProblem.label} tone={testnetProblem.tone}>
              Metadata loaded from active deployment. Reason: {testnetProblem.message}
            </DisclosureBanner>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Escrow funded"
              value={formatAmount(active?.escrowFunded, assetCode)}
              tone="green"
              testId="donor-escrow-balance"
            />
            <MetricCard
              label="Total distributed"
              value={
                live?.totalClaimed === undefined
                  ? testnetProblem
                    ? "Live read unavailable"
                    : "Pending live read"
                  : formatAmount(live.totalClaimed, assetCode)
              }
              tone="cyan"
              testId="donor-total-distributed"
            />
            <MetricCard
              label="Remaining budget"
              value={formatAmount(live?.remainingBudget ?? active?.budget, assetCode)}
            />
            <MetricCard label="Claim count" value={valueOrPending(live?.claimCount)} tone="green" />
            <MetricCard
              label="Verifier mode"
              value={verifierMode ?? "Pending live read"}
              tone={verifierMode === "real_groth16" ? "green" : "amber"}
            />
            <MetricCard
              label="Audit commitment"
              value={shortenAddress(active?.verificationKeyHash)}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel>
              <PanelHeader title="Public assurance" description="What donors can confirm without recipient identity data." />
              <div className="grid gap-4 p-5">
                <InfoCard title="Recipient privacy" icon={ShieldCheck} tone="green">
                  Identities, eligibility reasons, private witnesses, and Merkle paths are not
                  included in the public donor dashboard.
                </InfoCard>
                <InfoCard title="AIDUSD escrow" icon={WalletCards} tone="cyan">
                  Campaign accounting is shown from public deployment metadata and live read-only
                  contract state when available.
                </InfoCard>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Latest claim in this browser" description="Helpful during the video after Dora is submitted." />
              <div className="p-5">
                {lastTx ? (
                  <dl>
                    <KeyValue label="Claim tx" value={lastTx.txHash} />
                    <KeyValue label="Payout recipient" value={lastTx.payoutRecipient} />
                    <KeyValue
                      label="Payout amount"
                      value={
                        lastTx.payoutAmount === undefined
                          ? "Not available yet"
                          : formatAmount(lastTx.payoutAmount, lastTx.assetCode ?? assetCode)
                      }
                    />
                    <KeyValue label="Recipient balance after" value={lastTx.recipientBalanceAfter} />
                    <KeyValue label="Escrow balance after" value={lastTx.campaignEscrowAfter} />
                    <KeyValue label="Claimed at" value={new Date(lastTx.at).toLocaleString()} />
                  </dl>
                ) : (
                  <EmptyState title="No claim in this browser session">
                    Submit Dora from the recipient page, then return here to show the donor
                    accountability update.
                  </EmptyState>
                )}
              </div>
            </Panel>
          </div>

          <TechnicalDetails title="Public campaign data">
            <dl className="grid gap-x-6 md:grid-cols-2">
              <KeyValue label="Campaign contract" value={active?.campaignContractId} />
              <KeyValue label="Verifier contract" value={active?.verifierContractId} />
              <KeyValue label="AIDUSD/SAC contract" value={active?.assetContractId} />
              <KeyValue label="Campaign ID" value={active?.campaignId} />
              <KeyValue label="Eligibility root" value={active?.eligibilityRoot} />
              <KeyValue label="Compliance root" value={active?.complianceRoot} />
              <KeyValue label="Policy hash" value={active?.policyHash} />
              <KeyValue label="Verification key hash" value={active?.verificationKeyHash} />
              <KeyValue label="Actual token balance" value={live?.actualTokenBalance} />
              <KeyValue label="Read mode" value={state?.mode ?? "Pending live read"} />
            </dl>
          </TechnicalDetails>
        </>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Total budget" value={formatAmount(campaign.budget)} tone="cyan" />
            <MetricCard label="Total distributed" value={formatAmount(stats.totalClaimed)} tone="green" />
            <MetricCard label="Remaining budget" value={formatAmount(stats.remainingBudget)} />
            <MetricCard label="Successful claims" value={stats.claimCount.toString()} tone="green" />
            <MetricCard label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
            <MetricCard label="Rejected attempts" value={stats.invalidClaimsBlocked.toString()} tone="red" />
          </section>

          <Panel>
            <PanelHeader title="Recent local events" description="Local simulator trail for comparison only." />
            <div className="grid gap-3 p-5">
              {[...events].reverse().slice(0, 5).map((event) => (
                <div key={`${event.type}-${event.at}`} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <StatusDot
                      tone={
                        event.type === "claim_accepted"
                          ? "green"
                          : event.type === "duplicate_rejected"
                            ? "amber"
                            : event.type === "invalid_rejected"
                              ? "red"
                              : "cyan"
                      }
                      label={formatStatus(event.type)}
                    />
                    <span className="text-xs text-[#9fb0bb]">
                      {new Date(event.at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#dce7eb]">{event.message}</p>
                  {event.nullifierHash ? (
                    <p className="mt-2 font-mono text-xs text-[#9fb0bb]">
                      nullifier: {shortenAddress(event.nullifierHash)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
