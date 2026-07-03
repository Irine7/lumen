"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import {
  Button,
  DisclosureBanner,
  KeyValue,
  MetricCard,
  Panel,
  PanelHeader,
  TechnicalDetails
} from "@/components/ui";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";
import { formatAmount, shortenAddress } from "@/lib/format";

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
  }, [refreshTestnet]);

  useEffect(() => {
    function handleClaim() {
      setLastTx(readLastTx());
      refreshTestnet().catch(() => undefined);
    }

    window.addEventListener("lumen-testnet-claim", handleClaim);
    window.addEventListener("storage", handleClaim);
    return () => {
      window.removeEventListener("lumen-testnet-claim", handleClaim);
      window.removeEventListener("storage", handleClaim);
    };
  }, [refreshTestnet]);

  const state = testnetState.status === "loaded" ? testnetState.state : null;
  const active = state?.ok ? state.deployment : null;
  const live = state?.mode === "live" ? state.live : undefined;
  const testnetProblem = useMemo(() => describeStateProblem(state), [state]);
  const assetCode = active?.assetCode || "AIDUSD";
  const verifierMode = live?.verifierMode ?? active?.verifierMode;

  return (
    <div className="grid gap-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Donor Accountability
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aebdc5]">
              Real-time, verifiable impact.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="secondary" className="min-h-10">
              Last 30 days
            </Button>
            <Button type="button" variant="secondary" className="min-h-10">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-testid="donor-refresh-button"
              onClick={() => refreshTestnet().catch(() => undefined)}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Panel>

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Panel className="overflow-hidden">
              <PanelHeader title="Distribution over time" />
              <div className="p-5">
                <div className="relative h-72 overflow-hidden rounded-xl border border-white/10 bg-[#0b151d]/72 p-4">
                  <div className="absolute inset-4 grid grid-rows-5 text-xs text-[#8fa0a8]">
                    {["1.25M", "1M", "750k", "500k", "250k"].map((label) => (
                      <div key={label} className="border-b border-white/10">
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <svg className="absolute inset-x-4 bottom-10 h-44 w-[calc(100%-2rem)]" viewBox="0 0 600 176" aria-hidden="true">
                    <defs>
                      <linearGradient id="donorChartFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#69e6cf" stopOpacity="0.34" />
                        <stop offset="100%" stopColor="#69e6cf" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 166 L56 140 L110 108 L170 95 L230 92 L285 74 L348 60 L410 24 L468 12 L535 -18 L600 -32 L600 176 L0 176 Z"
                      fill="url(#donorChartFill)"
                    />
                    <path
                      d="M0 166 L56 140 L110 108 L170 95 L230 92 L285 74 L348 60 L410 24 L468 12 L535 -18 L600 -32"
                      fill="none"
                      stroke="#69e6cf"
                      strokeLinecap="round"
                      strokeWidth="4"
                    />
                  </svg>
                  <div className="absolute inset-x-6 bottom-4 flex justify-between text-xs text-[#9fb0bb]">
                    <span>May 1</span>
                    <span>May 8</span>
                    <span>May 15</span>
                    <span>May 22</span>
                    <span>May 29</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Campaign status" />
              <div className="p-5">
                <dl>
                  <KeyValue label="Campaign" value="Disaster Relief - Region 7" />
                  <KeyValue label="Status" value={active ? "Active" : "Reading"} />
                  <KeyValue label="Escrow" value={shortenAddress(active?.campaignContractId)} />
                  <KeyValue label="Network" value={`${assetCode} testnet`} />
                  <KeyValue label="Verifier" value={verifierMode ?? "Pending live read"} />
                  <KeyValue label="Last claim" value={lastTx?.txHash ?? "No claim in this browser session"} />
                </dl>
                <Button type="button" variant="secondary" className="mt-5 w-full">
                  View campaign
                </Button>
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
    </div>
  );
}
