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
  previewOnly?: boolean;
  createdAt?: string;
};

const STORAGE_KEY = "lumen-demo-audit-package";
const NO_PACKAGE = "No package loaded";
const DEMO_PREVIEW_PACKAGE: AuditPackage = {
  campaignId: "preview-demo-package",
  claimTxHash: "preview-no-claim-submitted",
  nullifierHash: "preview-generated-after-claim",
  amount: "100",
  asset: "AIDUSD",
  payoutAccountHash: "preview-generated-after-proof",
  eligibilityRoot: "preview-active-eligibility-root",
  complianceRoot: "preview-active-compliance-root",
  policyHash: "preview-active-policy-hash",
  auditCommitment: "preview-audit-commitment",
  proofVerified: false,
  recipientDisclosure: {
    demoRecipientName: "Dora",
    eligibilityReason: "Food and essentials emergency grant",
    complianceStatus: "cleared",
    payoutAddress: "preview-payout-address"
  },
  demoOnly: true,
  previewOnly: true,
  createdAt: "preview"
};

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
      const preview = JSON.stringify(DEMO_PREVIEW_PACKAGE, null, 2);
      setRawPackage(preview);
      setAuditPackage(DEMO_PREVIEW_PACKAGE);
      setError(null);
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

  const packageType = auditPackage
    ? auditPackage.previewOnly
      ? "preview demo package"
      : "real claim package from this browser"
    : "missing";
  const packageValue = (
    value: string | boolean | undefined | null,
    missing = "missing"
  ): string => {
    if (!auditPackage) {
      return NO_PACKAGE;
    }
    if (typeof value === "boolean") {
      return String(value);
    }
    return value ?? missing;
  };

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
            {!auditPackage ? (
              <p className="mt-3 text-sm leading-6 text-[#ffe4a3]">
                No disclosure package loaded yet. After a successful Dora claim, click "Load local package" to inspect the demo-only auditor disclosure.
              </p>
            ) : null}
            <dl className="mt-4">
              <KeyValue label="Package" value={auditPackage ? "present" : "missing"} />
              <KeyValue label="Package type" value={packageType} />
              <KeyValue label="Audit commitment" value={auditPackage?.auditCommitment ? "present" : auditPackage ? "missing" : "missing"} />
              <KeyValue label="Proof verified" value={auditPackage ? String(auditPackage.proofVerified) : "false"} />
            </dl>
          </div>
          <textarea
            value={rawPackage}
            onChange={(event) => setRawPackage(event.target.value)}
            className="min-h-40 rounded-lg border border-[#2b3845] bg-[#080b0f] p-3 font-mono text-xs leading-5 text-white outline-none focus:border-[#51d6ff]"
            placeholder="Paste a demo disclosure package JSON here, or use Load local package. If no claim package exists in this browser, Load local package opens a clearly labeled preview package."
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
            <KeyValue label="Campaign ID" value={packageValue(auditPackage?.campaignId)} />
            <KeyValue label="Claim tx" value={packageValue(auditPackage?.claimTxHash)} />
            <KeyValue label="Nullifier hash" value={packageValue(auditPackage?.nullifierHash)} />
            <KeyValue label="Amount" value={auditPackage ? `${auditPackage.amount} ${auditPackage.asset}` : NO_PACKAGE} />
            <KeyValue label="Payout account hash" value={packageValue(auditPackage?.payoutAccountHash)} />
            <KeyValue label="Eligibility root" value={packageValue(auditPackage?.eligibilityRoot)} />
            <KeyValue label="Compliance root" value={packageValue(auditPackage?.complianceRoot)} />
            <KeyValue label="Policy hash" value={packageValue(auditPackage?.policyHash)} />
            <KeyValue label="Audit commitment" value={packageValue(auditPackage?.auditCommitment)} />
            <KeyValue label="Proof verified" value={auditPackage ? String(auditPackage.proofVerified) : NO_PACKAGE} />
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
              value={packageValue(auditPackage?.recipientDisclosure?.demoRecipientName, "not disclosed")}
            />
            <KeyValue
              label="Eligibility reason"
              value={packageValue(auditPackage?.recipientDisclosure?.eligibilityReason, "not disclosed")}
            />
            <KeyValue
              label="Compliance status"
              value={packageValue(auditPackage?.recipientDisclosure?.complianceStatus, "not disclosed")}
            />
            <KeyValue
              label="Payout address"
              value={packageValue(auditPackage?.recipientDisclosure?.payoutAddress, "not disclosed")}
            />
            <KeyValue label="Proof verified" value={auditPackage ? String(auditPackage.proofVerified) : NO_PACKAGE} />
            <KeyValue label="Demo-only package" value={auditPackage ? String(Boolean(auditPackage.demoOnly)) : NO_PACKAGE} />
            <KeyValue label="Preview package" value={auditPackage ? String(Boolean(auditPackage.previewOnly)) : NO_PACKAGE} />
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
