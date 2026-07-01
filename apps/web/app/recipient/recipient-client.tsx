"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Play, Send, UserCheck, XCircle } from "lucide-react";
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

export function RecipientClient() {
  const { campaign, recipients, generateProof, submitProof, stats } = useLumenDemo();
  const [selectedId, setSelectedId] = useState<DemoRecipient["id"]>("alice");
  const visibleRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.id === "alice" || recipient.id === "mallory"),
    [recipients]
  );
  const selected = useMemo(
    () => visibleRecipients.find((recipient) => recipient.id === selectedId) ?? visibleRecipients[0]!,
    [selectedId, visibleRecipients]
  );
  const [amount, setAmount] = useState(selected.defaultClaimAmount);
  const [proofResult, setProofResult] = useState<ClaimProofResult | null>(null);
  const [claimResult, setClaimResult] = useState<SubmitClaimResult | null>(null);
  const [localVerifierOk, setLocalVerifierOk] = useState<boolean | null>(null);
  const [revealPrivate, setRevealPrivate] = useState(false);
  const [status, setStatus] = useState<ClaimUiStatus>("idle");

  function resetClaimState() {
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
        <Metric label="Campaign" value={campaign.name} />
        <Metric label="Remaining budget" value={`$${stats.remainingBudget}`} tone="cyan" />
        <Metric label="Claims accepted" value={stats.claimCount.toString()} tone="green" />
        <Metric label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader
            title="Recipient claim"
            description="Alice is the accepted path; Mallory demonstrates rejection. This browser flow uses the dev verifier envelope."
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
                    setAmount(recipient.defaultClaimAmount);
                    resetClaimState();
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
                    {recipient.eligible ? "Accepted demo path" : "Rejected demo path"}
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
                onChange={(event) => {
                  setAmount(Number(event.target.value));
                  resetClaimState();
                }}
                className="h-11 rounded-lg border border-[#2b3845] bg-[#080b0f] px-3 text-sm text-white outline-none focus:border-[#51d6ff]"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleGenerate}>
                <Play className="h-4 w-4" />
                Generate proof
              </Button>
              <Button type="button" variant="secondary" disabled={!proofResult} onClick={handleSubmit}>
                <Send className="h-4 w-4" />
                Submit claim
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={claimResult?.status !== "claim_accepted"}
                onClick={handleSubmit}
              >
                <AlertTriangle className="h-4 w-4" />
                Try duplicate
              </Button>
            </div>

            <FlowSteps
              selected={selected}
              proofResult={proofResult}
              localVerifierOk={localVerifierOk}
              claimResult={claimResult}
              status={status}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Claim data boundary"
            description="The public contract payload is separate from the recipient witness."
            action={
              <Button type="button" variant="secondary" onClick={() => setRevealPrivate((current) => !current)}>
                {revealPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {revealPrivate ? "Hide private values" : "Demo reveal private values"}
              </Button>
            }
          />
          <div className="grid gap-5 p-5 xl:grid-cols-2">
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <h3 className="text-sm font-semibold text-white">Private, not submitted publicly</h3>
              <p className="mt-1 text-xs leading-5 text-[#93a4ad]">
                Hidden by default for the demo; reveal only with synthetic fixture data.
              </p>
              <dl className="mt-3">
                <KeyValue
                  label="recipient secret"
                  value={selected.recipientSecret}
                  redacted={!revealPrivate}
                />
                <KeyValue
                  label="identity data"
                  value={`identity hash: ${selected.identityHash}; reason: ${selected.eligibilityReason}`}
                  redacted={!revealPrivate}
                />
                <KeyValue
                  label="Merkle path"
                  value={proofResult?.privateInputs?.eligibilityMerklePath.join(" / ") ?? "generate proof first"}
                  redacted={!revealPrivate}
                />
                <KeyValue
                  label="witness"
                  value={
                    proofResult?.privateInputs
                      ? JSON.stringify({
                          leafSalt: proofResult.privateInputs.leafSalt,
                          amountSalt: proofResult.privateInputs.amountSalt,
                          pathIndices: proofResult.privateInputs.eligibilityMerkleIndices
                        })
                      : "generate proof first"
                  }
                  redacted={!revealPrivate}
                />
              </dl>
            </div>

            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <h3 className="text-sm font-semibold text-white">Public, sent to contract</h3>
              <p className="mt-1 text-xs leading-5 text-[#93a4ad]">
                These values can be checked without revealing the recipient witness.
              </p>
              <dl className="mt-3">
                <KeyValue label="campaign ID" value={proofResult?.publicInputs.campaignId ?? campaign.campaignId} />
                <KeyValue label="eligibility root" value={proofResult?.publicInputs.eligibilityRoot ?? campaign.eligibilityRoot} />
                <KeyValue label="policy hash" value={proofResult?.publicInputs.policyHash ?? campaign.policyHash} />
                <KeyValue label="nullifier hash" value={proofResult?.publicInputs.nullifierHash} />
                <KeyValue label="amount" value={proofResult?.publicInputs.amount ?? amount} />
                <KeyValue label="proof" value={proofResult ? proofResult.proof.proof : "generate proof first"} />
              </dl>
              <div className="mt-4 rounded-lg border border-[#ffc857]/35 bg-[#ffc857]/10 p-3">
                <VerifierStatusBadge status="dev_on_chain" showDescription />
              </div>
            </div>
          </div>
          {proofResult?.errors.length ? (
            <div className="border-t border-[#202a34] p-5">
              <CodeBlock value={{ localConstraintErrors: proofResult.errors }} />
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function FlowSteps({
  selected,
  proofResult,
  localVerifierOk,
  claimResult,
  status
}: {
  selected: DemoRecipient;
  proofResult: ClaimProofResult | null;
  localVerifierOk: boolean | null;
  claimResult: SubmitClaimResult | null;
  status: ClaimUiStatus;
}) {
  const rows = [
    {
      number: "1",
      title: "Select Alice / Mallory",
      detail: `${selected.displayName} selected`,
      tone: "green" as const,
      state: "Selected"
    },
    {
      number: "2",
      title: "Generate proof",
      detail:
        status === "generating_proof"
          ? "Generating"
          : proofResult
            ? proofResult.ok
              ? "Demo proof envelope generated"
              : "Witness failed constraints"
            : "Waiting",
      state:
        status === "generating_proof"
          ? "Running"
          : proofResult
            ? proofResult.ok
              ? "Generated"
              : "Failed"
            : "Pending",
      tone:
        status === "generating_proof"
          ? ("cyan" as const)
          : proofResult
            ? proofResult.ok
              ? ("green" as const)
              : ("red" as const)
            : ("neutral" as const)
    },
    {
      number: "3",
      title: "Local verification status",
      detail:
        localVerifierOk === null
          ? "Waiting for proof"
          : localVerifierOk
            ? "Local demo verifier accepted"
            : "Local demo verifier rejected",
      state: localVerifierOk === null ? "Pending" : localVerifierOk ? "Accepted" : "Rejected",
      tone: localVerifierOk === null ? ("neutral" as const) : localVerifierOk ? ("green" as const) : ("red" as const)
    },
    {
      number: "4",
      title: "Submit claim",
      detail:
        status === "submitting"
          ? "Submitting to local Soroban-shaped state"
          : claimResult
            ? "Submitted"
            : "Waiting",
      state: status === "submitting" ? "Sending" : claimResult ? "Submitted" : "Pending",
      tone: status === "submitting" ? ("cyan" as const) : claimResult ? ("green" as const) : ("neutral" as const)
    },
    {
      number: "5",
      title: "Accepted / rejected result",
      detail: claimResult
        ? claimResult.status === "claim_accepted"
          ? "Accepted"
          : claimResult.status === "duplicate_rejected"
            ? "Duplicate blocked"
            : "Rejected"
        : "Waiting",
      state: claimResult
        ? claimResult.ok
          ? "Accepted"
          : claimResult.status === "duplicate_rejected"
            ? "Duplicate"
            : "Rejected"
        : "Pending",
      tone: claimResult
        ? claimResult.ok
          ? ("green" as const)
          : claimResult.status === "duplicate_rejected"
            ? ("amber" as const)
            : ("red" as const)
        : ("neutral" as const)
    }
  ];

  return (
    <div className="rounded-lg border border-[#26313d] bg-[#080b0f] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Demo claim path</h3>
        <VerifierStatusBadge status="dev_on_chain" />
      </div>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div
            key={row.number}
            className="grid gap-2 rounded-lg border border-[#202a34] bg-[#10161d] p-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#2b3845] bg-[#080b0f] text-xs font-semibold text-[#d8e7ec]">
              {row.number}
            </span>
            <div>
              <div className="text-sm font-semibold text-white">{row.title}</div>
              <div className="text-xs leading-5 text-[#93a4ad]">{row.detail}</div>
            </div>
            <StatusDot tone={row.tone} label={row.state} />
          </div>
        ))}
      </div>
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
  );
}
