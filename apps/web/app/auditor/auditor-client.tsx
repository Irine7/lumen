"use client";

import { useEffect, useState } from "react";
import { Eye, FileCheck2, LockKeyhole, RefreshCw } from "lucide-react";
import { Button, CodeBlock, KeyValue, Panel, PanelHeader, StatusDot } from "@/components/ui";

type AuditPackage = {
  campaignId: string;
  claimTxHash: string;
  nullifierHash: string;
  amount: string;
  asset: string;
  payoutAccountHash: string;
  eligibilityRoot: string;
  complianceRoot: string;
  policyHash: string;
  auditCommitment?: string;
  proofVerified: boolean;
  recipientDisclosure?: {
    demoRecipientName?: string;
    eligibilityReason?: string;
    complianceStatus?: string;
    payoutAddress?: string;
  };
  demoOnly?: boolean;
  createdAt?: string;
};

const STORAGE_KEY = "lumen-demo-audit-package";

function parsePackage(value: string): AuditPackage | null {
  try {
    const parsed = JSON.parse(value) as AuditPackage;
    if (!parsed || typeof parsed !== "object" || !parsed.campaignId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuditorClient() {
  const [rawPackage, setRawPackage] = useState("");
  const [auditPackage, setAuditPackage] = useState<AuditPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadStoredPackage() {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setError("No local demo disclosure package has been generated in this browser.");
      return;
    }
    setRawPackage(stored);
    const parsed = parsePackage(stored);
    setAuditPackage(parsed);
    setError(parsed ? null : "Stored package is not valid disclosure JSON.");
  }

  function parseTypedPackage() {
    const parsed = parsePackage(rawPackage);
    setAuditPackage(parsed);
    setError(parsed ? null : "Disclosure package JSON is invalid or missing campaignId.");
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setRawPackage(stored);
      setAuditPackage(parsePackage(stored));
    }
  }, []);

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Auditor disclosure"
          description="Demo-only selective disclosure for scoped review. Real KYC or sanctions-provider integration is not implemented."
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={loadStoredPackage}>
                <RefreshCw className="h-4 w-4" />
                Load local package
              </Button>
              <Button type="button" onClick={parseTypedPackage}>
                <FileCheck2 className="h-4 w-4" />
                Verify package
              </Button>
            </div>
          }
        />
        <div className="grid gap-4 p-5">
          <div data-testid="auditor-package-status" className="rounded-lg border border-[#ffc857]/35 bg-[#ffc857]/10 p-4">
            <StatusDot
              tone={auditPackage ? "green" : "amber"}
              label={
                auditPackage
                  ? "Demo-only selective disclosure loaded. Not production view keys."
                  : "Demo-only selective disclosure. Not production view keys."
              }
            />
          </div>
          <textarea
            value={rawPackage}
            onChange={(event) => setRawPackage(event.target.value)}
            className="min-h-40 rounded-lg border border-[#2b3845] bg-[#080b0f] p-3 font-mono text-xs leading-5 text-white outline-none focus:border-[#51d6ff]"
            spellCheck={false}
          />
          {error ? (
            <div className="rounded-lg border border-[#ff6b6b]/45 bg-[#ff6b6b]/10 p-4">
              <StatusDot tone="red" label={error} />
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Public donor view"
            description="Public donors see proof commitments and aggregate accounting, not recipient details."
            action={<LockKeyhole className="h-5 w-5 text-[#51d6ff]" />}
          />
          <dl className="p-5">
            <KeyValue label="Campaign ID" value={auditPackage?.campaignId ?? "load package"} />
            <KeyValue label="Claim tx" value={auditPackage?.claimTxHash ?? "load package"} />
            <KeyValue label="Nullifier hash" value={auditPackage?.nullifierHash ?? "load package"} />
            <KeyValue label="Amount" value={auditPackage ? `${auditPackage.amount} ${auditPackage.asset}` : "load package"} />
            <KeyValue label="Payout account hash" value={auditPackage?.payoutAccountHash ?? "load package"} />
            <KeyValue label="Eligibility root" value={auditPackage?.eligibilityRoot ?? "load package"} />
            <KeyValue label="Compliance root" value={auditPackage?.complianceRoot ?? "load package"} />
            <KeyValue label="Policy hash" value={auditPackage?.policyHash ?? "load package"} />
            <KeyValue label="Audit commitment" value={auditPackage?.auditCommitment ?? "not included"} />
            <KeyValue label="Proof verified" value={auditPackage ? String(auditPackage.proofVerified) : "load package"} />
          </dl>
        </Panel>

        <Panel>
          <PanelHeader
            title="Auditor selective view"
            description="This panel is auditor-only demo evidence and is not public by default."
            action={<Eye className="h-5 w-5 text-[#5df0a3]" />}
          />
          <dl className="p-5">
            <KeyValue
              label="Demo recipient"
              value={auditPackage?.recipientDisclosure?.demoRecipientName ?? "not disclosed"}
            />
            <KeyValue
              label="Eligibility reason"
              value={auditPackage?.recipientDisclosure?.eligibilityReason ?? "not disclosed"}
            />
            <KeyValue
              label="Compliance status"
              value={auditPackage?.recipientDisclosure?.complianceStatus ?? "not disclosed"}
            />
            <KeyValue
              label="Payout address"
              value={auditPackage?.recipientDisclosure?.payoutAddress ?? "not disclosed"}
            />
            <KeyValue label="Proof verified" value={auditPackage ? String(auditPackage.proofVerified) : "load package"} />
            <KeyValue label="Demo-only package" value={auditPackage ? String(Boolean(auditPackage.demoOnly)) : "load package"} />
          </dl>
        </Panel>
      </div>

      {auditPackage ? (
        <Panel>
          <PanelHeader title="Loaded package" />
          <div className="p-5">
            <CodeBlock value={auditPackage} />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
