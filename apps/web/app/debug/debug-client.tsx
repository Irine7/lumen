"use client";

import { useState } from "react";
import { AlertTriangle, Play } from "lucide-react";
import type { ClaimProofResult, DemoRecipient } from "@lumen-aid/shared";
import { verifyClaimProofLocally } from "@lumen-aid/prover";
import {
  Button,
  CodeBlock,
  DisclosureBanner,
  KeyValue,
  Panel,
  PanelHeader,
  StatusDot,
  VerifierStatusBadge
} from "@/components/ui";
import { useLumenDemo } from "@/lib/demo-runtime";

export function DebugClient() {
  const { campaign, recipients, tree, complianceTree, generateProof } = useLumenDemo();
  const [selectedId, setSelectedId] = useState<DemoRecipient["id"]>("alice");
  const [amount, setAmount] = useState(125);
  const [proofResult, setProofResult] = useState<ClaimProofResult | null>(null);
  const [localVerifierOk, setLocalVerifierOk] = useState<boolean | null>(null);
  const selected = recipients.find((recipient) => recipient.id === selectedId) ?? recipients[0]!;

  async function inspect() {
    const result = await generateProof(selected, amount);
    setProofResult(result);
    setLocalVerifierOk(await verifyClaimProofLocally(result.proof, result.publicInputs));
  }

  return (
    <div className="grid gap-6">
      <DisclosureBanner title="Debug mode" tone="red">
        <span className="inline-flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ff8b8b]" aria-hidden />
          <span>
            Synthetic demo values only. Never use this screen with real recipient data. This
            route intentionally exposes private witness material for inspecting fixtures.
          </span>
        </span>
      </DisclosureBanner>

      <Panel>
        <PanelHeader
          title="Developer proof inspector"
          description="Demo-only page: full private witness is intentionally visible here for protocol inspection."
          action={
            <div className="flex flex-col gap-2 sm:items-end">
              <VerifierStatusBadge status="dev_on_chain" />
              <StatusDot
                tone={localVerifierOk === null ? "neutral" : localVerifierOk ? "green" : "red"}
                label={
                  localVerifierOk === null
                    ? "No proof inspected"
                    : localVerifierOk
                      ? "Demo verifier accepted"
                      : "Demo verifier rejected"
                }
              />
            </div>
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_160px_180px]">
          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Recipient
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value as DemoRecipient["id"])}
              className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-[#d8e7ec]">
            Amount
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="h-11 rounded-xl border border-white/10 bg-[#071012] px-3 text-sm text-white outline-none focus:border-[#69e6cf]"
            />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={inspect} className="w-full">
              <Play className="h-4 w-4" />
              Inspect
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Proof markers" />
          <dl className="p-5">
            <KeyValue label="Eligibility root" value={campaign.eligibilityRoot} />
            <KeyValue label="Compliance root" value={campaign.complianceRoot} />
            <KeyValue label="Compliance status" value={selected.complianceStatus} />
            <KeyValue label="Nullifier" value={proofResult?.publicInputs.nullifierHash ?? "generate first"} />
            <KeyValue label="Public inputs hash" value={proofResult?.proof.publicInputsHash ?? "generate first"} />
            <KeyValue label="Proof mode" value={proofResult?.mode ?? "dev_verifier"} />
            <KeyValue label="Browser verifier status" value="Dev-only on-chain verifier" />
            <KeyValue
              label="Documented real paths"
              value="Real local Groth16 scripts and real deployed testnet verification are documented outside this browser flow"
            />
            <KeyValue label="Constraint status" value={proofResult?.ok ? "passed" : proofResult ? "failed" : "Waiting for inspection"} />
          </dl>
        </Panel>

        <Panel>
          <PanelHeader title="Merkle tree" />
          <CodeBlock
            value={{
              eligibilityRoot: tree.root,
              eligibilityLayers: tree.layers,
              complianceRoot: complianceTree.root,
              complianceLayers: complianceTree.layers
            }}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Private inputs" description="Visible only on this debug route." />
          <div className="p-5">
            <CodeBlock value={proofResult?.privateInputs ?? "No private witness generated"} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Public inputs and proof" />
          <div className="grid gap-4 p-5">
            <CodeBlock value={proofResult?.publicInputs ?? "No public inputs generated"} />
            <CodeBlock value={proofResult?.proof ?? "No proof generated"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
