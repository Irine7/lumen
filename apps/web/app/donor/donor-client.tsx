"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, MonitorCog, RefreshCw } from "lucide-react";
import {
  Button,
  KeyValue,
  Metric,
  Panel,
  PanelHeader,
  StatusDot,
  VerifierStatusBadge
} from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";
import {
  fetchActiveTestnetState,
  type ActiveTestnetState
} from "@/lib/active-testnet-state";

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
      label: "Live stats unavailable",
      message: state.error ?? "Active deployment metadata loaded, but live contract reads failed."
    };
  }

  return {
    tone: "red",
    label: "Testnet state read failed",
    message: state.error ?? state.computed.statusMessage
  };
}

function unavailable(state: ActiveTestnetState | null): string {
  return state?.error ? `unavailable: ${state.error}` : "unavailable";
}

function metricValue(value: number | undefined, state: ActiveTestnetState | null): string {
  return value === undefined ? unavailable(state) : value.toString();
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
              campaignState: "unread",
              readyForFullDemo: false,
              statusMessage: error instanceof Error ? error.message : String(error)
            }
          },
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
  const testnetProblem = useMemo(() => {
    if (testnetState.status !== "loaded") {
      return null;
    }
    return describeStateProblem(testnetState.state);
  }, [testnetState]);

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Campaign accountability"
          description={
            mode === "testnet"
              ? "Live active Stellar testnet campaign state."
              : "Local browser simulator state, explicitly separate from testnet."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Dashboard mode">
                <Button
                  type="button"
                  variant={mode === "testnet" ? "primary" : "secondary"}
                  onClick={() => setMode("testnet")}
                >
                  <Database className="h-4 w-4" />
                  Testnet state
                </Button>
                <Button
                  type="button"
                  variant={mode === "demo" ? "primary" : "secondary"}
                  onClick={() => setMode("demo")}
                >
                  <MonitorCog className="h-4 w-4" />
                  Local Demo
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
                  Reset
                </Button>
              )}
            </div>
          }
        />
        <div className="grid gap-4 p-5">
          {mode === "testnet" && testnetState.status === "loading" ? (
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <StatusDot tone="cyan" label="Reading active testnet state" />
            </div>
          ) : null}

          {mode === "testnet" && state ? (
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <StatusDot
                tone={state.mode === "live" ? "green" : state.mode === "metadata_only" ? "amber" : "red"}
                label={
                  state.mode === "live"
                    ? "Testnet state configured"
                    : state.mode === "metadata_only"
                      ? "Testnet metadata configured"
                      : "Testnet state unavailable"
                }
              />
              <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
                {state.computed.statusMessage}
              </p>
            </div>
          ) : null}

          {mode === "testnet" && testnetProblem ? (
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <StatusDot tone={testnetProblem.tone} label={testnetProblem.label} />
              <p className="mt-3 break-words text-sm leading-6 text-[#d8e7ec]">
                {testnetProblem.message}
              </p>
            </div>
          ) : null}

          {mode === "testnet" && active ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Metric label="Configured budget" value={active.budget} tone="cyan" />
              <Metric label={`${active.assetCode} escrow funded`} value={active.escrowFunded} tone="green" />
              <Metric
                label="Total distributed"
                value={metricValue(live?.totalClaimed, state)}
                tone="green"
                data-testid="donor-total-distributed"
              />
              <Metric
                label="Remaining budget"
                value={metricValue(live?.remainingBudget, state)}
              />
              <Metric
                label="Actual token / escrow balance"
                value={metricValue(live?.actualTokenBalance ?? live?.escrowBalance, state)}
                data-testid="donor-escrow-balance"
              />
              <Metric
                label="Claim count"
                value={metricValue(live?.claimCount, state)}
                tone="green"
              />
              <Metric
                label="Duplicates blocked"
                value={metricValue(live?.duplicateClaimsBlocked, state)}
                tone="amber"
              />
              <Metric
                label="Non-compliant/ineligible attempts blocked"
                value={metricValue(live?.invalidClaimsBlocked, state)}
                tone="red"
              />
              <Metric label="Verifier mode" value={live?.verifierMode ?? unavailable(state)} tone="cyan" />
            </div>
          ) : null}

          {mode === "demo" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Metric label="Total budget" value={`$${campaign.budget}`} tone="cyan" />
              <Metric label="Total distributed" value={`$${stats.totalClaimed}`} tone="green" />
              <Metric label="Remaining budget" value={`$${stats.remainingBudget}`} />
              <Metric label="Successful claims" value={stats.claimCount.toString()} tone="green" />
              <Metric label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
              <Metric label="Non-compliant/ineligible blocked" value={stats.invalidClaimsBlocked.toString()} tone="red" />
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Verifier and latest claim" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            {mode === "testnet" && active ? (
              <>
                <StatusDot
                  tone={live?.verifierMode === "real_groth16" ? "green" : "amber"}
                  label={`Verifier mode: ${live?.verifierMode ?? unavailable(state)}`}
                />
                <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
                  {state?.error
                    ? `Verifier live read note: ${state.error}`
                    : "Verifier status comes from the shared read-only testnet state endpoint."}
                </p>
              </>
            ) : (
              <VerifierStatusBadge status="dev_on_chain" showDescription />
            )}
          </div>
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot tone={lastTx ? "green" : "neutral"} label="Last browser testnet tx" />
            <dl className="mt-4">
              <KeyValue label="Tx hash" value={lastTx?.txHash ?? "none in this browser session"} />
              <KeyValue label="Last payout recipient" value={lastTx?.payoutRecipient ?? "none"} />
              <KeyValue
                label="Last payout amount"
                value={
                  lastTx?.payoutAmount === undefined
                    ? "none"
                    : `${lastTx.payoutAmount} ${lastTx.assetCode ?? active?.assetCode ?? "testnet asset"}`
                }
              />
              <KeyValue
                label="Recipient balance after"
                value={lastTx?.recipientBalanceAfter ?? "none"}
              />
              <KeyValue
                label="Escrow balance after"
                value={lastTx?.campaignEscrowAfter ?? "none"}
              />
              <KeyValue label="Claimed at" value={lastTx ? new Date(lastTx.at).toLocaleString() : "none"} />
            </dl>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader title="Public campaign data" />
          <dl className="p-5">
            {mode === "testnet" && active ? (
              <>
                <KeyValue label="Campaign contract ID" value={active.campaignContractId} />
                <KeyValue label="Verifier contract ID" value={active.verifierContractId} />
                <KeyValue label="Asset code" value={active.assetCode} />
                <KeyValue label="Asset contract ID" value={active.assetContractId} />
                <KeyValue label="Campaign ID" value={active.campaignId} />
                <KeyValue label="Eligibility root" value={active.eligibilityRoot} />
                <KeyValue label="Compliance root" value={active.complianceRoot} />
                <KeyValue label="Policy hash" value={active.policyHash} />
                <KeyValue label="Budget" value={active.budget} />
                <KeyValue label="Escrow funded" value={active.escrowFunded} />
                <KeyValue label="Actual token / escrow balance" value={metricValue(live?.actualTokenBalance ?? live?.escrowBalance, state)} />
                <KeyValue label="Per-recipient cap" value={active.perRecipientCap} />
                <KeyValue label="Verifier key hash" value={active.verificationKeyHash} />
              </>
            ) : (
              <>
                <KeyValue label="Mode" value="Local Demo" />
                <KeyValue label="Campaign name" value={campaign.name} />
                <KeyValue label="Eligibility root" value={campaign.eligibilityRoot} />
                <KeyValue label="Compliance root" value={campaign.complianceRoot} />
                <KeyValue label="Policy hash" value={campaign.policyHash} />
                <KeyValue label="Asset" value={campaign.asset} />
              </>
            )}
          </dl>
        </Panel>

        <Panel>
          <PanelHeader
            title={mode === "testnet" ? "Read status" : "Recent local events"}
            description={
              mode === "testnet"
                ? "Testnet panel uses active deployment data and read-only RPC simulation."
                : "Local Soroban-shaped event stream."
            }
          />
          <div className="grid gap-3 p-5">
            {mode === "testnet" ? (
              <div className="rounded-lg border border-[#26313d] bg-[#111820] p-4">
                <StatusDot
                  tone={testnetProblem ? testnetProblem.tone : active ? "green" : "amber"}
                  label={testnetProblem ? testnetProblem.label : active ? "Active testnet read ready" : "Waiting"}
                />
                <dl className="mt-4">
                  <KeyValue label="Read mode" value={state?.mode ?? "not loaded"} />
                  <KeyValue label="Recipient identity" value="hidden by ZK proof" />
                  <KeyValue label="Compliance clearance" value="hidden by ZK proof" />
                  <KeyValue label="Payout address" value="public Stellar address" />
                  <KeyValue label="Selective disclosure" value="auditor-only demo package" />
                  <KeyValue label="Witness data" value="never leaves browser" />
                  <KeyValue label="Fallback data" value="none in Testnet state mode" />
                </dl>
              </div>
            ) : (
              [...events].reverse().slice(0, 8).map((event) => (
                <div key={`${event.type}-${event.at}`} className="rounded-lg border border-[#26313d] bg-[#111820] p-4">
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
                      label={event.type.replaceAll("_", " ")}
                    />
                    <span className="text-xs text-[#93a4ad]">{new Date(event.at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#d8e7ec]">{event.message}</p>
                  {event.nullifierHash ? (
                    <p className="mt-2 break-all font-mono text-xs text-[#93a4ad]">
                      nullifier: {event.nullifierHash}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
