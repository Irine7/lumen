"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  MonitorCog,
  Play,
  Send,
  UserCheck,
  XCircle
} from "lucide-react";
import type { ClaimProofResult, ClaimUiStatus, DemoRecipient } from "@lumen-aid/shared";
import type { SubmitClaimResult } from "@lumen-aid/stellar";
import { verifyClaimProofLocally } from "@lumen-aid/prover";
import {
  Button,
  CodeBlock,
  KeyValue,
  Metric,
  Panel,
  PanelHeader,
  StatusDot,
  VerifierStatusBadge
} from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";
import { generateBrowserClaimProof } from "@/lib/zk/browser-proof-client";
import type { BrowserClaimProofResult, BrowserProofStatus } from "@/lib/zk/types";
import {
  activeTestnetRecipients,
  activeToCampaign,
  fetchActiveTestnetConfig,
  verifierModeLabel,
  type ActiveTestnetConfigResult
} from "@/lib/testnet-active";

type RecipientMode = "real" | "local" | "debug";

type TestnetClaimResult = {
  ok: boolean;
  status: string;
  message: string;
  txHash?: string | null;
  readableResult?: string;
  stats?: {
    total_claimed?: string;
    totalClaimed?: string;
    claim_count?: number;
    claimCount?: number;
    remaining_budget?: string;
    remainingBudget?: string;
    duplicate_claims_blocked?: number;
    duplicateClaimsBlocked?: number;
    invalid_claims_blocked?: number;
    invalidClaimsBlocked?: number;
  } | null;
};

const LAST_TX_STORAGE_KEY = "lumen-last-testnet-tx";

export function RecipientClient() {
  const [mode, setMode] = useState<RecipientMode>("real");

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Recipient claim"
          description="Run a real browser Groth16 proof to Stellar testnet, or switch to the local simulator for comparison."
          action={
            <div className="flex flex-wrap gap-2" role="group" aria-label="Claim mode">
              <Button
                type="button"
                variant={mode === "real" ? "primary" : "secondary"}
                onClick={() => setMode("real")}
              >
                <Database className="h-4 w-4" />
                Real Testnet Claim
              </Button>
              <Button
                type="button"
                variant={mode === "local" ? "primary" : "secondary"}
                onClick={() => setMode("local")}
              >
                <MonitorCog className="h-4 w-4" />
                Local Demo
              </Button>
              <Button
                type="button"
                variant={mode === "debug" ? "primary" : "secondary"}
                onClick={() => setMode("debug")}
              >
                <Eye className="h-4 w-4" />
                Debug
              </Button>
            </div>
          }
        />
      </Panel>

      {mode === "real" ? <RealTestnetClaim /> : null}
      {mode === "local" ? <LocalDemoClaim /> : null}
      {mode === "debug" ? <DebugClaimData /> : null}
    </div>
  );
}
function RealTestnetClaim() {
  const [activeResult, setActiveResult] = useState<ActiveTestnetConfigResult>({
    status: "not_configured",
    message: "Loading active testnet deployment"
  });
  const [selectedId, setSelectedId] = useState<DemoRecipient["id"]>("alice");
  const selected = useMemo(
    () =>
      activeTestnetRecipients.find((recipient) => recipient.id === selectedId) ??
      activeTestnetRecipients[0]!,
    [selectedId]
  );
  const [amount, setAmount] = useState(selected.defaultClaimAmount);
  const [proofStatus, setProofStatus] = useState<BrowserProofStatus | "idle">("idle");
  const [proofResult, setProofResult] = useState<BrowserClaimProofResult | null>(null);
  const [claimResult, setClaimResult] = useState<TestnetClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchActiveTestnetConfig()
      .then((result) => {
        if (!cancelled) {
          setActiveResult(result);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setActiveResult({
            status: "error",
            message: fetchError instanceof Error ? fetchError.message : String(fetchError)
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const active = activeResult.status === "ready" ? activeResult.active : null;
  const campaign = useMemo(() => (active ? activeToCampaign(active) : null), [active]);

  function resetClaimState(nextAmount = amount) {
    setAmount(nextAmount);
    setProofStatus("idle");
    setProofResult(null);
    setClaimResult(null);
    setError(null);
  }

  async function handleGenerate() {
    if (!campaign || !active) {
      setError("Active testnet deployment is not loaded");
      return;
    }

    setProofResult(null);
    setClaimResult(null);
    setError(null);
    setProofStatus("loading artifacts");
    try {
      const result = await generateBrowserClaimProof(
        {
          campaign,
          recipient: selected,
          recipients: activeTestnetRecipients,
          amount
        },
        setProofStatus
      );
      setProofResult(result);
      setProofStatus(result.localVerification ? "ready to submit" : "failed");
    } catch (proofError) {
      setProofStatus("failed");
      setError(proofError instanceof Error ? proofError.message : String(proofError));
    }
  }

  async function submitToTestnet() {
    if (!proofResult || !active) {
      return;
    }

    setError(null);
    const response = await fetch("/api/testnet/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proofEncodingForSoroban: proofResult.proofEncodingForSoroban,
        publicInputs: proofResult.publicInputs,
        campaignContractId: active.campaignContractId,
        campaignId: active.campaignId
      })
    });
    const result = (await response.json()) as TestnetClaimResult;
    setClaimResult(result);
    if (result.ok && result.txHash) {
      window.localStorage.setItem(
        LAST_TX_STORAGE_KEY,
        JSON.stringify({
          txHash: result.txHash,
          campaignContractId: active.campaignContractId,
          at: new Date().toISOString()
        })
      );
      window.dispatchEvent(new Event("lumen-testnet-claim"));
    }
  }

  const statusTone =
    proofStatus === "failed"
      ? "red"
      : proofStatus === "ready to submit"
        ? "green"
        : proofStatus === "idle"
          ? "neutral"
          : "cyan";

  return (
    <div className="grid gap-6">
      {activeResult.status !== "ready" ? (
        <Panel>
          <div className="p-5">
            <StatusDot
              tone={activeResult.status === "error" ? "red" : "amber"}
              label="Active testnet campaign not ready"
            />
            <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">{activeResult.message}</p>
          </div>
        </Panel>
      ) : null}

      {active && campaign ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Submission" value="Stellar testnet" tone="cyan" />
            <Metric label="Local proof verification" value="real Groth16" tone="green" />
            <Metric label="Budget" value={`$${campaign.budget}`} />
            <Metric label="Per-recipient cap" value={`$${campaign.perRecipientCap}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel>
              <PanelHeader
                title="Real Testnet Claim"
                description="Private witness data stays in this browser worker; the relayer receives only proof bytes and public inputs."
                action={<VerifierStatusBadge status="real_on_chain" />}
              />
              <div className="grid gap-5 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {active.recipients.map((publicRecipient) => {
                    const recipient =
                      activeTestnetRecipients.find((item) => item.id === publicRecipient.id) ??
                      activeTestnetRecipients[0]!;
                    return (
                      <button
                        key={recipient.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(recipient.id);
                          resetClaimState(recipient.defaultClaimAmount);
                        }}
                        className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#51d6ff]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] ${
                          selectedId === recipient.id
                            ? "border-[#51d6ff] bg-[#101d25]"
                            : "border-[#26313d] bg-[#10161d] hover:border-[#3b4a58]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">{recipient.displayName}</span>
                          {recipient.eligible ? (
                            <UserCheck className="h-4 w-4 text-[#5df0a3]" />
                          ) : (
                            <XCircle className="h-4 w-4 text-[#ff6b6b]" />
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#93a4ad]">
                          {recipient.eligible ? "Eligible active testnet recipient" : "Ineligible test case"}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <label className="grid gap-2 text-sm text-[#d8e7ec]">
                  Claim amount
                  <input
                    type="number"
                    min={1}
                    max={campaign.perRecipientCap}
                    value={amount}
                    onChange={(event) => resetClaimState(Number(event.target.value))}
                    className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleGenerate}>
                    <Play className="h-4 w-4" />
                    Generate real browser ZK proof
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!proofResult?.localVerification}
                    onClick={submitToTestnet}
                  >
                    <Send className="h-4 w-4" />
                    Submit proof to Stellar testnet
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!proofResult?.localVerification || claimResult?.status !== "claim_accepted"}
                    onClick={submitToTestnet}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Try duplicate claim
                  </Button>
                </div>

                <div className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
                  <StatusDot tone={statusTone} label={`Proof status: ${proofStatus}`} />
                  <div className="mt-4 grid gap-0">
                    <KeyValue label="Verifier mode" value={verifierModeLabel(active)} />
                    <KeyValue label="Submission" value="Stellar testnet" />
                    <KeyValue
                      label="Local proof verification"
                      value={
                        proofResult
                          ? proofResult.localVerification
                            ? "real Groth16 accepted"
                            : "real Groth16 rejected"
                          : "generate proof first"
                      }
                    />
                    <KeyValue label="Tx hash" value={claimResult?.txHash ?? "submit proof first"} />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-lg border border-[#ff6b6b]/45 bg-[#ff6b6b]/10 p-4">
                    <StatusDot tone="red" label="Real testnet claim failed" />
                    <p className="mt-3 text-sm leading-6 text-[#ffd0d0]">{error}</p>
                  </div>
                ) : null}

                {claimResult ? <TestnetClaimOutcome result={claimResult} /> : null}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Public claim payload"
                description="Only these public values and proof bytes are sent to the relayer."
              />
              <div className="grid gap-5 p-5">
                <dl>
                  <KeyValue label="Campaign contract ID" value={active.campaignContractId} />
                  <KeyValue label="Verifier contract ID" value={active.verifierContractId} />
                  <KeyValue label="Campaign ID" value={proofResult?.publicInputs.campaignId ?? active.campaignId} />
                  <KeyValue
                    label="Eligibility root"
                    value={proofResult?.publicInputs.eligibilityRoot ?? active.eligibilityRoot}
                  />
                  <KeyValue label="Policy hash" value={proofResult?.publicInputs.policyHash ?? active.policyHash} />
                  <KeyValue label="Nullifier hash" value={proofResult?.publicInputs.nullifierHash} />
                  <KeyValue label="Amount commitment" value={proofResult?.publicInputs.amountCommitment} />
                  <KeyValue label="Recipient commitment" value={proofResult?.publicInputs.recipientCommitment} />
                </dl>
                {proofResult ? (
                  <CodeBlock
                    value={{
                      mode: proofResult.mode,
                      publicSignals: proofResult.publicSignals,
                      timingsMs: proofResult.timings
                    }}
                  />
                ) : null}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TestnetClaimOutcome({ result }: { result: TestnetClaimResult }) {
  const accepted = result.ok && result.status === "claim_accepted";
  return (
    <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
      <StatusDot
        tone={accepted ? "green" : result.status.includes("duplicate") ? "amber" : "red"}
        label={result.status.replaceAll("_", " ")}
      />
      <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">{result.message}</p>
      {result.txHash ? (
        <p className="mt-2 break-all font-mono text-xs text-[#93a4ad]">tx: {result.txHash}</p>
      ) : null}
    </div>
  );
}

function LocalDemoClaim() {
  const { campaign, recipients, generateProof, submitProof, stats } = useLumenDemo();
  const visibleRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.id === "alice" || recipient.id === "mallory"),
    [recipients]
  );
  const [selectedId, setSelectedId] = useState<DemoRecipient["id"]>("alice");
  const selected = useMemo(
    () => visibleRecipients.find((recipient) => recipient.id === selectedId) ?? visibleRecipients[0]!,
    [selectedId, visibleRecipients]
  );
  const [amount, setAmount] = useState(selected.defaultClaimAmount);
  const [proofResult, setProofResult] = useState<ClaimProofResult | null>(null);
  const [claimResult, setClaimResult] = useState<SubmitClaimResult | null>(null);
  const [localVerifierOk, setLocalVerifierOk] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ClaimUiStatus>("idle");

  function resetClaimState(nextAmount = amount) {
    setAmount(nextAmount);
    setProofResult(null);
    setClaimResult(null);
    setLocalVerifierOk(null);
    setStatus("idle");
  }

  async function handleGenerate() {
    setClaimResult(null);
    setLocalVerifierOk(null);
    setStatus("generating_proof");
    const result = await generateProof(selected, amount);
    const localOk = await verifyClaimProofLocally(result.proof, result.publicInputs);
    setProofResult(result);
    setLocalVerifierOk(localOk);
    setStatus(result.ok && localOk ? "proof_generated" : "invalid_rejected");
  }

  async function handleSubmit() {
    if (!proofResult) {
      return;
    }

    setStatus("submitting");
    const result = await submitProof(proofResult);
    setClaimResult(result);
    if (result.status === "claim_accepted") setStatus("accepted");
    if (result.status === "duplicate_rejected") setStatus("duplicate_rejected");
    if (result.status === "invalid_rejected") setStatus("invalid_rejected");
    if (result.status === "campaign_closed") setStatus("invalid_rejected");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Mode" value="Local Demo" />
        <Metric label="Remaining budget" value={`$${stats.remainingBudget}`} tone="cyan" />
        <Metric label="Claims accepted" value={stats.claimCount.toString()} tone="green" />
        <Metric label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
      </div>

      <Panel>
        <PanelHeader
          title="Local Demo"
          description="Simulator state and dev-verifier envelope retained for local comparison."
          action={<VerifierStatusBadge status="dev_on_chain" />}
        />
        <div className="grid gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleRecipients.map((recipient) => (
              <button
                key={recipient.id}
                type="button"
                onClick={() => {
                  setSelectedId(recipient.id);
                  resetClaimState(recipient.defaultClaimAmount);
                }}
                className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#51d6ff]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] ${
                  selectedId === recipient.id
                    ? "border-[#51d6ff] bg-[#101d25]"
                    : "border-[#26313d] bg-[#10161d] hover:border-[#3b4a58]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{recipient.displayName}</span>
                  {recipient.eligible ? (
                    <UserCheck className="h-4 w-4 text-[#5df0a3]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[#ff6b6b]" />
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#93a4ad]">
                  {recipient.eligible ? "Accepted simulator path" : "Rejected simulator path"}
                </p>
              </button>
            ))}
          </div>

          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Claim amount
            <input
              type="number"
              min={1}
              max={campaign.perRecipientCap}
              value={amount}
              onChange={(event) => resetClaimState(Number(event.target.value))}
              className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleGenerate}>
              <Play className="h-4 w-4" />
              Generate local demo proof
            </Button>
            <Button type="button" variant="secondary" disabled={!proofResult} onClick={handleSubmit}>
              <Send className="h-4 w-4" />
              Submit to local demo
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={claimResult?.status !== "claim_accepted"}
              onClick={handleSubmit}
            >
              <AlertTriangle className="h-4 w-4" />
              Try duplicate claim
            </Button>
          </div>

          <div className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
            <StatusDot
              tone={
                status === "accepted"
                  ? "green"
                  : status === "duplicate_rejected"
                    ? "amber"
                    : status === "invalid_rejected"
                      ? "red"
                      : status === "generating_proof" || status === "submitting"
                        ? "cyan"
                        : "neutral"
              }
              label={`Local demo status: ${status}`}
            />
            <dl className="mt-4">
              <KeyValue label="Local proof verification" value={localVerifierOk === null ? "pending" : String(localVerifierOk)} />
              <KeyValue label="Public proof envelope" value={proofResult?.proof.proof ?? "generate proof first"} />
            </dl>
            {claimResult ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-[#d8e7ec]">
                {claimResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-[#5df0a3]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#ff6b6b]" />
                )}
                {claimResult.message}
              </p>
            ) : null}
          </div>

          {proofResult?.errors.length ? <CodeBlock value={{ localConstraintErrors: proofResult.errors }} /> : null}
        </div>
      </Panel>
    </div>
  );
}

function DebugClaimData() {
  const { campaign, tree } = useLumenDemo();
  const [selectedId, setSelectedId] = useState<DemoRecipient["id"]>("alice");
  const [revealPrivate, setRevealPrivate] = useState(false);
  const selected = useMemo(
    () =>
      activeTestnetRecipients.find((recipient) => recipient.id === selectedId) ??
      activeTestnetRecipients[0]!,
    [selectedId]
  );
  const leaf = tree.recipientLeafById[selected.id] ?? "not in local demo tree";

  return (
    <Panel>
      <PanelHeader
        title="Debug"
        description="Synthetic fixture values only. Private demo values stay hidden unless explicitly revealed here."
        action={
          <Button type="button" variant="secondary" onClick={() => setRevealPrivate((current) => !current)}>
            {revealPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {revealPrivate ? "Hide private values" : "Reveal private values"}
          </Button>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3">
          {activeTestnetRecipients.map((recipient) => (
            <button
              key={recipient.id}
              type="button"
              onClick={() => {
                setSelectedId(recipient.id);
                setRevealPrivate(false);
              }}
              className={`rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#51d6ff]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] ${
                selectedId === recipient.id
                  ? "border-[#51d6ff] bg-[#101d25]"
                  : "border-[#26313d] bg-[#10161d] hover:border-[#3b4a58]"
              }`}
            >
              <span className="font-semibold text-white">{recipient.displayName}</span>
              <p className="mt-1 text-xs text-[#93a4ad]">
                {recipient.eligible ? "Eligible fixture" : "Ineligible fixture"}
              </p>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[#ffc857]/35 bg-[#ffc857]/10 p-4">
          <StatusDot tone="amber" label="Debug reveal warning" />
          <p className="mt-3 text-sm leading-6 text-[#ffe4a3]">
            These are synthetic demo witness values. This panel is not part of the real testnet
            submission payload.
          </p>
          <dl className="mt-4">
            <KeyValue label="Recipient" value={selected.displayName} />
            <KeyValue label="Campaign policy hash" value={campaign.policyHash} />
            <KeyValue label="Local demo leaf" value={leaf} redacted={!revealPrivate} />
            <KeyValue label="recipient_secret" value={selected.recipientSecret} redacted={!revealPrivate} />
            <KeyValue label="identity_hash" value={selected.identityHash} redacted={!revealPrivate} />
            <KeyValue label="leaf_salt" value={selected.leafSalt} redacted={!revealPrivate} />
            <KeyValue label="amount_salt" value={selected.amountSalt} redacted={!revealPrivate} />
          </dl>
        </div>
      </div>
    </Panel>
  );
}
