"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, MonitorCog, RefreshCw } from "lucide-react";
import {
  getCampaignConfig,
  getCampaignStats,
  getVerifierStatus,
  type StellarReadResult,
  type TestnetCampaignConfig,
  type TestnetCampaignStats,
  type TestnetVerifierStatus
} from "@lumen-aid/stellar";
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
  activeToStellarEnv,
  fetchActiveTestnetConfig,
  verifierModeLabel,
  type ActiveTestnetConfigResult
} from "@/lib/testnet-active";

type DashboardMode = "testnet" | "demo";

type TestnetReadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      active: ActiveTestnetConfigResult;
      config: StellarReadResult<TestnetCampaignConfig> | null;
      stats: StellarReadResult<TestnetCampaignStats> | null;
      verifier: StellarReadResult<TestnetVerifierStatus> | null;
    };

type LastTx = {
  txHash: string;
  campaignContractId: string;
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

function describeReadProblem(
  result: StellarReadResult<unknown> | ActiveTestnetConfigResult | null
): {
  tone: "amber" | "red";
  label: string;
  message: string;
} | null {
  if (!result || result.status === "ready") {
    return null;
  }

  if (result.status === "not_configured") {
    return {
      tone: "amber",
      label: "Testnet not configured",
      message: result.message
    };
  }

  return {
    tone: "red",
    label: "Testnet read failed",
    message: result.message
  };
}

export function DonorClient() {
  const { campaign, stats, events, resetDemo } = useLumenDemo();
  const [mode, setMode] = useState<DashboardMode>("testnet");
  const [testnetState, setTestnetState] = useState<TestnetReadState>({ status: "idle" });
  const [lastTx, setLastTx] = useState<LastTx | null>(null);

  const refreshTestnet = useCallback(async (cancelled?: { value: boolean }) => {
    setTestnetState({ status: "loading" });
    const active = await fetchActiveTestnetConfig();
    if (cancelled?.value) {
      return;
    }

    if (active.status !== "ready") {
      setTestnetState({
        status: "loaded",
        active,
        config: null,
        stats: null,
        verifier: null
      });
      return;
    }

    const env = activeToStellarEnv(active.active);
    const [config, testnetStats, verifier] = await Promise.all([
      getCampaignConfig(env),
      getCampaignStats(env),
      getVerifierStatus(env)
    ]);
    if (cancelled?.value) {
      return;
    }

    setTestnetState({
      status: "loaded",
      active,
      config,
      stats: testnetStats,
      verifier
    });
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
          active: {
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          },
          config: null,
          stats: null,
          verifier: null
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

  const active = testnetState.status === "loaded" && testnetState.active.status === "ready"
    ? testnetState.active.active
    : null;
  const testnetConfig =
    testnetState.status === "loaded" && testnetState.config?.status === "ready"
      ? testnetState.config.data
      : null;
  const testnetStats =
    testnetState.status === "loaded" && testnetState.stats?.status === "ready"
      ? testnetState.stats.data
      : null;
  const testnetVerifier =
    testnetState.status === "loaded" && testnetState.verifier?.status === "ready"
      ? testnetState.verifier.data
      : null;
  const testnetProblem = useMemo(() => {
    if (testnetState.status !== "loaded") {
      return null;
    }
    return (
      describeReadProblem(testnetState.active) ??
      describeReadProblem(testnetState.config) ??
      describeReadProblem(testnetState.stats) ??
      describeReadProblem(testnetState.verifier)
    );
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
              <Metric label="Budget" value={`$${testnetConfig?.budget ?? active.budget}`} tone="cyan" />
              <Metric
                label="Total claimed"
                value={`$${testnetStats?.totalClaimed ?? "unread"}`}
                tone="green"
              />
              <Metric
                label="Remaining budget"
                value={`$${testnetStats?.remainingBudget ?? "unread"}`}
              />
              <Metric
                label="Claim count"
                value={testnetStats?.claimCount.toString() ?? "unread"}
                tone="green"
              />
              <Metric
                label="Duplicates blocked"
                value={testnetStats?.duplicateClaimsBlocked.toString() ?? "unread"}
                tone="amber"
              />
              <Metric
                label="Invalid claims blocked"
                value={testnetStats?.invalidClaimsBlocked.toString() ?? "unread"}
                tone="red"
              />
            </div>
          ) : null}

          {mode === "demo" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Metric label="Total budget" value={`$${campaign.budget}`} tone="cyan" />
              <Metric label="Total distributed" value={`$${stats.totalClaimed}`} tone="green" />
              <Metric label="Remaining budget" value={`$${stats.remainingBudget}`} />
              <Metric label="Successful claims" value={stats.claimCount.toString()} tone="green" />
              <Metric label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
              <Metric label="Invalid claims blocked" value={stats.invalidClaimsBlocked.toString()} tone="red" />
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
                  tone={testnetVerifier?.mode === "real_groth16" ? "green" : "amber"}
                  label={
                    testnetVerifier
                      ? `Verifier mode: ${testnetVerifier.mode}`
                      : verifierModeLabel(active)
                  }
                />
                <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
                  {testnetVerifier?.notes ?? verifierModeLabel(active)}
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
                <KeyValue label="Mock token contract ID" value={active.mockTokenContractId} />
                <KeyValue label="Campaign ID" value={testnetConfig?.campaignId ?? active.campaignId} />
                <KeyValue
                  label="Eligibility root"
                  value={testnetConfig?.eligibilityRoot ?? active.eligibilityRoot}
                />
                <KeyValue label="Policy hash" value={testnetConfig?.policyHash ?? active.policyHash} />
                <KeyValue label="Budget" value={testnetConfig?.budget ?? active.budget} />
                <KeyValue label="Per-recipient cap" value={testnetConfig?.perRecipientCap ?? active.perRecipientCap} />
                <KeyValue
                  label="Verifier key hash"
                  value={
                    testnetVerifier?.verificationKeyHash ??
                    (active.verifierInfo.mode === "legacy_not_introspectable"
                      ? "legacy verifier, mode not introspectable"
                      : active.verifierInfo.verificationKeyHash)
                  }
                />
              </>
            ) : (
              <>
                <KeyValue label="Mode" value="Local Demo" />
                <KeyValue label="Campaign name" value={campaign.name} />
                <KeyValue label="Eligibility root" value={campaign.eligibilityRoot} />
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
                <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
                  This dashboard does not fall back to local mock data while Testnet state is selected.
                </p>
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
