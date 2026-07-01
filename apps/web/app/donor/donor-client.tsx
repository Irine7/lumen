"use client";

import { RefreshCw } from "lucide-react";
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

export function DonorClient() {
  const { campaign, stats, events, resetDemo } = useLumenDemo();

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Campaign accountability"
          description="Public aggregate state, without a recipient list."
          action={
            <Button type="button" variant="secondary" onClick={resetDemo}>
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          }
        />
        <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
          <Metric label="Total budget" value={`$${campaign.budget}`} tone="cyan" />
          <Metric label="Total distributed" value={`$${stats.totalClaimed}`} tone="green" />
          <Metric label="Remaining budget" value={`$${stats.remainingBudget}`} />
          <Metric label="Successful claims" value={stats.claimCount.toString()} tone="green" />
          <Metric label="Duplicates blocked" value={stats.duplicateClaimsBlocked.toString()} tone="amber" />
          <Metric label="Invalid claims blocked" value={stats.invalidClaimsBlocked.toString()} tone="red" />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Privacy and verifier status"
          description="What donors can learn from this browser demo without overstating the verifier path."
        />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <StatusDot tone="green" label="Privacy status" />
            <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
              Recipient identities, eligibility reasons, private witnesses, and Merkle paths are not
              included in the public claim payload.
            </p>
          </div>
          <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
            <VerifierStatusBadge status="dev_on_chain" showDescription />
            <p className="mt-3 text-sm leading-6 text-[#d8e7ec]">
              Real local Groth16 and deployed testnet verification are documented; this dashboard reads
              the local browser demo state.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <PanelHeader title="Public campaign data" />
          <dl className="p-5">
            <KeyValue label="Campaign name" value={campaign.name} />
            <KeyValue label="Current eligibility root" value={campaign.eligibilityRoot} />
            <KeyValue label="Policy hash" value={campaign.policyHash} />
            <KeyValue label="Asset" value={campaign.asset} />
            <KeyValue label="Privacy status" value="Private recipient data is not in the public claim payload" />
            <KeyValue label="Verifier status" value="Dev-only on-chain verifier in browser demo" />
            <KeyValue label="Deny-list root" value={campaign.denyRoot ?? "not enforced in MVP"} />
          </dl>
        </Panel>

        <Panel>
          <PanelHeader title="Recent events" description="Local Soroban-shaped event stream." />
          <div className="grid gap-3 p-5">
            {[...events].reverse().slice(0, 8).map((event) => (
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
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
