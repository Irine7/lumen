"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Play,
  Send,
  UserCheck,
  XCircle
} from "lucide-react";
import type { DemoRecipient } from "@lumen-aid/shared";
import { derivePayoutAccountHash } from "@lumen-aid/stellar";
import {
  Button,
  CodeBlock,
  DisclosureBanner,
  KeyValue,
  Metric,
  Panel,
  PanelHeader,
  StatusDot,
  TechnicalDetails,
  VerifierStatusBadge
} from "@/components/ui";
import { generateBrowserClaimProof } from "@/lib/zk/browser-proof-client";
import type { BrowserClaimProofResult, BrowserProofStatus } from "@/lib/zk/types";
import {
  activeTestnetRecipients,
  activeToCampaign,
  fetchActiveTestnetConfig,
  verifierModeLabel,
  type ActiveTestnetConfigResult
} from "@/lib/testnet-active";

type TestnetClaimResult = {
  ok: boolean;
  status: string;
  message: string;
  txHash?: string | null;
  payoutAmount?: number;
  payoutRecipient?: string;
  assetCode?: string;
  assetContractId?: string | null;
  recipientBalanceBefore?: string | null;
  recipientBalanceAfter?: string | null;
  campaignEscrowBefore?: string | null;
  campaignEscrowAfter?: string | null;
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
const LAST_AUDIT_PACKAGE_STORAGE_KEY = "lumen-demo-audit-package";
const claimSteps = [
  "Select recipient",
  "Generate proof",
  "Verify in browser",
  "Submit claim",
  "Payout result"
];

export function RecipientClient() {
  return (
    <div className="grid gap-6">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              My Claim
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aebdc5]">
              Private. Browser-verified. Verifiable.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-6">
          <div className="grid gap-5 md:grid-cols-5">
            {claimSteps.map((step, index) => {
              const active = index === 0;
              return (
                <div key={step} className="relative grid justify-items-center gap-2 text-center">
                  {index > 0 ? (
                    <span className="absolute right-1/2 top-6 hidden h-px w-full bg-white/25 md:block" />
                  ) : null}
                  <span
                    className={`relative z-10 grid h-12 w-12 place-items-center rounded-full border text-sm font-semibold ${
                      active
                        ? "border-[#69e6cf] bg-[#123a38] text-[#cafff4] shadow-[0_0_28px_rgba(105,230,207,0.22)]"
                        : "border-white/15 bg-[#17242f] text-[#dce7eb]"
                    }`}
                  >
                    {active ? <UserCheck className="h-5 w-5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="text-sm font-medium text-white">{index + 1}</span>
                  <span className="text-xs leading-5 text-[#aebdc5]">{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <RealTestnetClaim />
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
  const [payoutAddress, setPayoutAddress] = useState("");
  const [payoutSource, setPayoutSource] = useState<"verified" | "freighter" | "manual">("verified");

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
  const activeRecipient = useMemo(
    () => active?.recipients.find((recipient) => recipient.id === selectedId) ?? null,
    [active, selectedId]
  );
  const demoPayoutAddress = activeRecipient?.payoutAddress ?? selected.payoutAddress ?? "";
  const payoutAccountHash = useMemo(() => {
    if (!payoutAddress) {
      return null;
    }
    try {
      return derivePayoutAccountHash(payoutAddress);
    } catch {
      return null;
    }
  }, [payoutAddress]);

  useEffect(() => {
    if (demoPayoutAddress && payoutSource === "verified") {
      setPayoutAddress(demoPayoutAddress);
    }
  }, [demoPayoutAddress, payoutSource]);

  function resetClaimState(nextAmount = amount) {
    setAmount(nextAmount);
    setProofStatus("idle");
    setProofResult(null);
    setClaimResult(null);
    setError(null);
  }

  async function connectFreighter() {
    const freighter = (window as unknown as {
      freighterApi?: {
        getAddress?: () => Promise<string | { address?: string }>;
        isConnected?: () => Promise<boolean>;
      };
    }).freighterApi;
    if (!freighter?.getAddress) {
      setError("Freighter is not available in this browser");
      return;
    }
    const result = await freighter.getAddress();
    const address = typeof result === "string" ? result : result.address;
    if (!address) {
      setError("Freighter did not return a public address");
      return;
    }
    setPayoutSource("freighter");
    setPayoutAddress(address);
    resetClaimState();
  }

  function useVerifiedRecipientAddress() {
    setPayoutSource("verified");
    setPayoutAddress(demoPayoutAddress);
    resetClaimState();
  }

  async function auditCommitment(input: BrowserClaimProofResult): Promise<string> {
    const payload = [
      input.publicInputs.campaignId,
      input.publicInputs.nullifierHash,
      input.publicInputs.amount,
      input.publicInputs.payoutAccountHash,
      input.publicInputs.policyHash,
      input.publicInputs.complianceRoot
    ].join("|");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  async function handleGenerate() {
    if (!campaign || !active) {
      setError("Active testnet deployment is not loaded");
      return;
    }
    if (!payoutAddress || !payoutAccountHash) {
      setError("Choose a valid Stellar payout address before generating the proof");
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
          amount,
          payoutAddress,
          payoutAccountHash
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

  async function submitToTestnet(payoutRecipientOverride?: string) {
    if (!proofResult || !active) {
      return;
    }

    setError(null);
    const submittedPayoutRecipient = payoutRecipientOverride ?? payoutAddress;
    const response = await fetch("/api/testnet/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proofEncodingForSoroban: proofResult.proofEncodingForSoroban,
        publicInputs: proofResult.publicInputs,
        payoutRecipient: submittedPayoutRecipient,
        campaignContractId: active.campaignContractId,
        campaignId: active.campaignId
      })
    });
    const result = (await response.json()) as TestnetClaimResult;
    setClaimResult(result);
    if (result.ok && result.txHash) {
      const commitment = await auditCommitment(proofResult);
      window.localStorage.setItem(
        LAST_TX_STORAGE_KEY,
        JSON.stringify({
          txHash: result.txHash,
          campaignContractId: active.campaignContractId,
          payoutRecipient: result.payoutRecipient ?? payoutAddress,
          payoutAmount: result.payoutAmount,
          assetCode: result.assetCode,
          recipientBalanceAfter: result.recipientBalanceAfter,
          campaignEscrowAfter: result.campaignEscrowAfter,
          at: new Date().toISOString()
        })
      );
      window.localStorage.setItem(
        LAST_AUDIT_PACKAGE_STORAGE_KEY,
        JSON.stringify({
          campaignId: proofResult.publicInputs.campaignId,
          claimTxHash: result.txHash,
          nullifierHash: proofResult.publicInputs.nullifierHash,
          amount: String(proofResult.publicInputs.amount),
          asset: result.assetCode ?? active.assetCode ?? "testnet asset",
          payoutAccountHash: proofResult.publicInputs.payoutAccountHash,
          eligibilityRoot: proofResult.publicInputs.eligibilityRoot,
          complianceRoot: proofResult.publicInputs.complianceRoot,
          policyHash: proofResult.publicInputs.policyHash,
          auditCommitment: commitment,
          proofVerified: proofResult.localVerification,
          recipientDisclosure: {
            recipientName: selected.displayName,
            eligibilityReason: selected.eligibilityReason,
            complianceStatus: selected.complianceStatus,
            payoutAddress
          },
          createdAt: new Date().toISOString()
        })
      );
      window.dispatchEvent(new Event("lumen-testnet-claim"));
    }
  }

  function chooseScenario(recipientId: DemoRecipient["id"]) {
    const recipient =
      activeTestnetRecipients.find((item) => item.id === recipientId) ??
      activeTestnetRecipients[0]!;
    setSelectedId(recipient.id);
    setPayoutSource("verified");
    resetClaimState(recipient.defaultClaimAmount);
  }

  function swappedPayoutAddress(): string | null {
    if (!active) {
      return null;
    }
    return (
      active.recipients.find(
        (recipient) => recipient.id !== selectedId && recipient.payoutAddress
      )?.payoutAddress ?? null
    );
  }

  const statusTone =
    proofStatus === "failed"
      ? "red"
      : proofStatus === "ready to submit"
        ? "green"
        : proofStatus === "idle"
          ? "neutral"
          : "cyan";
  const localVerificationLabel = proofResult
    ? proofResult.localVerification
      ? "passed (real Groth16 accepted)"
      : "failed (real Groth16 rejected)"
    : proofStatus === "failed"
      ? "failed"
      : "Waiting for proof";
  const recordingProofStatus = proofResult
    ? "Generated"
    : proofStatus === "failed"
      ? "Failed"
      : proofStatus === "idle"
        ? "Waiting for proof"
        : "Generating";
  const submitReadiness = proofResult?.localVerification
    ? "Ready to submit"
    : "Disabled until browser verification passes";
  const claimResultLabel = claimResult ? (claimResult.ok ? "Accepted" : "Rejected") : "Not submitted yet";
  const balanceDeltaLabel = claimResult?.campaignEscrowAfter
    ? `${claimResult.campaignEscrowBefore ?? "?"} -> ${claimResult.campaignEscrowAfter}`
    : "Will update after claim";
  const selectedRecordingStatus =
    selected.id === "dora"
      ? "eligible + compliant; Ready for valid claim"
      : selected.id === "eve"
        ? "eligible but not compliance-cleared; expected result: proof generation fails before submission"
        : selected.id === "mallory"
          ? "not eligible and not compliance-cleared; expected result: proof generation fails before submission"
          : selected.eligible && selected.compliant
            ? "eligible + compliant"
            : "not ready for valid claim";
  const generatedAfterProof = "Will be generated after proof";
  const selectedScenario =
    selectedId === "alice"
      ? claimResult?.status === "duplicate_rejected"
        ? "Duplicate claim: Alice again"
        : "Valid recipient: Alice"
      : selectedId === "eve"
        ? "Non-compliant: Eve"
        : selectedId === "mallory"
          ? "Ineligible: Mallory"
          : "Valid recipient";

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
            <Metric label="Browser proof verification" value="real Groth16" tone="green" />
            <Metric label="Asset" value={active.assetCode ?? "testnet asset"} />
            <Metric label="Escrow funded" value={active.escrowFunded ?? active.budget} />
          </div>

          <DisclosureBanner title="Privacy note" tone="cyan">
            Private witness stays in the browser worker. The relayer receives only proof bytes,
            public inputs, and the public payout address.
          </DisclosureBanner>

          <Panel>
            <PanelHeader
              title="Guided scenario"
              description="Use the same proof flow for the positive claim and the expected rejection cases."
            />
            <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid gap-3">
                {[
                  { label: "Valid recipient: Alice", action: () => chooseScenario("alice") },
                  { label: "Duplicate claim: Alice again", action: () => submitToTestnet() },
                  { label: "Non-compliant: Eve", action: () => chooseScenario("eve") },
                  { label: "Ineligible: Mallory", action: () => chooseScenario("mallory") },
                  { label: "Payout swap: blocked", action: () => {
                    const swapped = swappedPayoutAddress();
                    if (swapped) void submitToTestnet(swapped);
                  } }
                ].map((scenario) => (
                  <Button
                    key={scenario.label}
                    type="button"
                    variant={selectedScenario === scenario.label ? "primary" : "secondary"}
                    disabled={
                      scenario.label === "Duplicate claim: Alice again"
                        ? !proofResult?.localVerification || claimResult?.status !== "claim_accepted"
                        : scenario.label === "Payout swap: blocked"
                          ? !proofResult?.localVerification || !swappedPayoutAddress()
                          : false
                    }
                    onClick={scenario.action}
                  >
                    {scenario.label}
                  </Button>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <StatusDot tone={statusTone} label={selectedScenario} />
                <dl className="mt-4">
                  <KeyValue label="Selected recipient" value={`${selected.displayName}: ${selectedRecordingStatus}`} />
                  <KeyValue label="Proof status" value={recordingProofStatus} />
                  <div data-testid="local-verification-status">
                    <KeyValue label="Browser verification" value={localVerificationLabel} />
                  </div>
                  <KeyValue label="Submit readiness" value={submitReadiness} />
                  <KeyValue label="Claim result" value={claimResultLabel} />
                  <KeyValue label="Balance/escrow delta" value={balanceDeltaLabel} />
                  <KeyValue
                    label="Privacy note"
                    value="Private witness stays in the browser worker. Relayer receives only proof bytes and public inputs."
                  />
                </dl>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel>
              <PanelHeader
                title="Real Testnet Claim"
                description="Private witness stays in the browser worker. Relayer receives only proof bytes and public inputs."
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
                        data-testid={`recipient-card-${recipient.id}`}
                        onClick={() => {
                          setSelectedId(recipient.id);
                          resetClaimState(recipient.defaultClaimAmount);
                        }}
                        className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] ${
                          selectedId === recipient.id
                            ? "border-[#69e6cf]/70 bg-[#69e6cf]/10"
                            : "border-white/10 bg-white/[0.045] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">{recipient.displayName}</span>
                          {recipient.eligible && recipient.compliant ? (
                            <UserCheck className="h-4 w-4 text-[#5df0a3]" />
                          ) : (
                            <XCircle className="h-4 w-4 text-[#ff6b6b]" />
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#93a4ad]">
                          {recipient.eligible && recipient.compliant
                            ? "Eligible + compliant. Ready for valid claim."
                            : recipient.eligible
                              ? "Eligible but not compliance-cleared. Expected proof failure before submission."
                              : "Not eligible and not compliance-cleared. Expected proof failure before submission."}
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
                  className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" onClick={connectFreighter}>
                      Connect Freighter
                    </Button>
                    <Button type="button" variant="secondary" onClick={useVerifiedRecipientAddress}>
                      Use verified payout address
                    </Button>
                  </div>
                  <label className="mt-4 grid gap-2 text-sm text-[#d8e7ec]">
                    Payout address
                    <input
                      value={payoutAddress}
                      onChange={(event) => {
                        setPayoutSource("manual");
                        setPayoutAddress(event.target.value);
                        setProofResult(null);
                        setClaimResult(null);
                      }}
                      className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 font-mono text-xs text-white outline-none focus:border-[#69e6cf]"
                    />
                  </label>
                  <dl className="mt-4">
                    <KeyValue label="Eligibility" value="hidden, proven in ZK" />
                    <KeyValue label="Compliance clearance" value="hidden, proven in ZK" />
                    <KeyValue label="Fee payer" value="Stellar relayer" />
                    <KeyValue label="Payout recipient source" value={payoutSource} />
                    <KeyValue label="Proof bound to recipient" value={payoutAccountHash ? "yes" : "Waiting for valid payout address"} />
                    <KeyValue label="payout_account_hash" value={payoutAccountHash ?? "Waiting for valid payout address"} />
                  </dl>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" data-testid="generate-proof-button" onClick={handleGenerate}>
                    <Play className="h-4 w-4" />
                    Generate real browser Groth16 proof
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="submit-claim-button"
                    disabled={!proofResult?.localVerification}
                    onClick={() => submitToTestnet()}
                  >
                    <Send className="h-4 w-4" />
                    Submit payout claim to Stellar testnet
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="duplicate-claim-button"
                    disabled={!proofResult?.localVerification || claimResult?.status !== "claim_accepted"}
                    onClick={() => submitToTestnet()}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Try duplicate payout claim
                  </Button>
                  <Button type="button" variant="secondary" data-testid="eve-negative-button" onClick={() => chooseScenario("eve")}>
                    <AlertTriangle className="h-4 w-4" />
                    Try non-compliant recipient
                  </Button>
                  <Button type="button" variant="secondary" data-testid="mallory-negative-button" onClick={() => chooseScenario("mallory")}>
                    <AlertTriangle className="h-4 w-4" />
                    Try ineligible recipient
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!proofResult?.localVerification || !swappedPayoutAddress()}
                    onClick={() => {
                      const swapped = swappedPayoutAddress();
                      if (swapped) {
                        void submitToTestnet(swapped);
                      }
                    }}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Try swapped payout address
                  </Button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <StatusDot tone={statusTone} label={`Proof status: ${recordingProofStatus}`} />
                  <div className="mt-4 grid gap-0">
                    <KeyValue label="Selected" value={`${selected.displayName}: ${selectedRecordingStatus}`} />
                    <KeyValue label="Verifier mode" value={verifierModeLabel(active)} />
                    <KeyValue label="Submission" value="Stellar testnet" />
                    <KeyValue label="Browser verification" value={localVerificationLabel} />
                    <KeyValue label="Submit readiness" value={submitReadiness} />
                    <KeyValue label="Claim result" value={claimResultLabel} />
                    <KeyValue label="Tx hash" value={claimResult?.txHash ?? "Not submitted yet"} />
                    <KeyValue label="Payout recipient" value={claimResult?.payoutRecipient ?? payoutAddress} />
                    <KeyValue
                      label="Recipient balance"
                      value={
                        claimResult?.recipientBalanceAfter
                          ? `${claimResult.recipientBalanceBefore ?? "?"} -> ${claimResult.recipientBalanceAfter}`
                          : "Not submitted yet"
                      }
                    />
                    <KeyValue
                      label="Escrow balance"
                      value={
                        claimResult?.campaignEscrowAfter
                          ? `${claimResult.campaignEscrowBefore ?? "?"} -> ${claimResult.campaignEscrowAfter}`
                          : "Not submitted yet"
                      }
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-[#ff8b8b]/35 bg-[#ff8b8b]/10 p-4">
                    <StatusDot tone="red" label="Real testnet claim failed" />
                    <p className="mt-3 text-sm leading-6 text-[#ffd0d0]">{error}</p>
                  </div>
                ) : null}

                {claimResult ? <TestnetClaimOutcome result={claimResult} /> : null}
              </div>
            </Panel>

            <TechnicalDetails title="Public claim payload">
              <div className="grid gap-5">
                <p className="text-sm leading-6 text-[#9fb0bb]">
                  Only these public values and proof bytes are sent to the relayer.
                </p>
                <dl>
                  <KeyValue label="Campaign contract ID" value={active.campaignContractId} />
                  <KeyValue label="Verifier contract ID" value={active.verifierContractId} />
                  <KeyValue label="Campaign ID" value={proofResult?.publicInputs.campaignId ?? active.campaignId} />
                  <KeyValue
                    label="Eligibility root"
                    value={proofResult?.publicInputs.eligibilityRoot ?? active.eligibilityRoot}
                  />
                  <KeyValue
                    label="Compliance root"
                    value={proofResult?.publicInputs.complianceRoot ?? active.complianceRoot}
                  />
                  <KeyValue label="Policy hash" value={proofResult?.publicInputs.policyHash ?? active.policyHash} />
                  <KeyValue label="Nullifier hash" value={proofResult?.publicInputs.nullifierHash ?? generatedAfterProof} />
                  <KeyValue label="Amount commitment" value={proofResult?.publicInputs.amountCommitment ?? generatedAfterProof} />
                  <KeyValue label="Recipient commitment" value={proofResult?.publicInputs.recipientCommitment ?? generatedAfterProof} />
                  <KeyValue label="Payout account hash" value={proofResult?.publicInputs.payoutAccountHash ?? generatedAfterProof} />
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
            </TechnicalDetails>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TestnetClaimOutcome({ result }: { result: TestnetClaimResult }) {
  const accepted = result.ok && result.status === "claim_accepted";
  return (
    <div data-testid="claim-result-status" className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
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
