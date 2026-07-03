"use client";

import { useEffect, useState } from "react";
import { Eye, FileCheck2, LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import {
  Button,
  CodeBlock,
  DisclosureBanner,
  EmptyState,
  KeyValue,
  Panel,
  PanelHeader,
  StatusPill,
  TechnicalDetails
} from "@/components/ui";

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
      setRawPackage("");
      setAuditPackage(null);
      setError(null);
      return;
    }
    setRawPackage(stored);
    const parsed = parsePackage(stored);
    setAuditPackage(parsed);
    setError(parsed ? null : "Stored package is not valid disclosure JSON.");
  }

  function loadPreviewPackage() {
    const preview = JSON.stringify(DEMO_PREVIEW_PACKAGE, null, 2);
    setRawPackage(preview);
    setAuditPackage(DEMO_PREVIEW_PACKAGE);
    setError(null);
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
      ? "Preview only - no live claim loaded yet"
      : "Real claim package from this browser"
    : NO_PACKAGE;
  const packageValue = (
    value: string | boolean | undefined | null,
    missing = "Not disclosed"
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
      <Panel className="overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="amber">Demo-only selective disclosure</StatusPill>
              <StatusPill tone={auditPackage ? "green" : "neutral"}>{packageType}</StatusPill>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Auditor disclosure
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#bac9cf]">
              Demo-only selective disclosure for scoped review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="secondary" onClick={loadStoredPackage}>
              <RefreshCw className="h-4 w-4" />
              Load local package
            </Button>
            <Button type="button" variant="secondary" onClick={loadPreviewPackage}>
              <Sparkles className="h-4 w-4" />
              Load preview package
            </Button>
            <Button type="button" onClick={parseTypedPackage}>
              <FileCheck2 className="h-4 w-4" />
              Verify package
            </Button>
          </div>
        </div>
      </Panel>

      <DisclosureBanner title="Demo-only selective disclosure" tone="amber">
        Not production view keys. No real KYC or sanctions-provider integration is implied.
      </DisclosureBanner>

      <div data-testid="auditor-package-status">
        {!auditPackage ? (
          <EmptyState title="No disclosure package loaded yet.">
            After a successful Dora claim, load the local package to inspect the auditor-only demo
            evidence. A clearly labeled preview package is available for recording the empty-state
            flow.
          </EmptyState>
        ) : auditPackage.previewOnly ? (
          <DisclosureBanner title="Preview only - no live claim loaded yet" tone="cyan">
            This package is sample evidence for the video. It is not generated from a live Dora
            claim in this browser session.
          </DisclosureBanner>
        ) : (
          <DisclosureBanner title="Disclosure package loaded" tone="cyan">
            Local demo evidence is available for scoped auditor review.
          </DisclosureBanner>
        )}
      </div>

      {error ? (
        <DisclosureBanner title="Package verification failed" tone="red">
          {error}
        </DisclosureBanner>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Public donor view"
            description="Public donors see proof commitments and aggregate accounting, not recipient details."
            action={<LockKeyhole className="h-5 w-5 text-[#69e6cf]" />}
          />
          {auditPackage ? (
            <dl className="p-5">
              <KeyValue label="Claim tx" value={packageValue(auditPackage.claimTxHash)} />
              <KeyValue label="Nullifier" value={packageValue(auditPackage.nullifierHash)} />
              <KeyValue label="Amount" value={`${auditPackage.amount} ${auditPackage.asset}`} />
              <KeyValue label="Payout account hash" value={packageValue(auditPackage.payoutAccountHash)} />
              <KeyValue label="Eligibility root" value={packageValue(auditPackage.eligibilityRoot)} />
              <KeyValue label="Compliance root" value={packageValue(auditPackage.complianceRoot)} />
              <KeyValue label="Policy hash" value={packageValue(auditPackage.policyHash)} />
              <KeyValue label="Audit commitment" value={packageValue(auditPackage.auditCommitment)} />
              <KeyValue label="Proof verified" value={String(auditPackage.proofVerified)} />
            </dl>
          ) : (
            <div className="p-5">
              <EmptyState title={NO_PACKAGE}>
                Public commitments will appear here after a real local claim package is loaded.
              </EmptyState>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Auditor selective view"
            description="Auditor-only demo evidence; not public by default."
            action={<Eye className="h-5 w-5 text-[#78f1b2]" />}
          />
          {auditPackage ? (
            <dl className="p-5">
              <KeyValue
                label="Demo recipient"
                value={packageValue(auditPackage.recipientDisclosure?.demoRecipientName)}
              />
              <KeyValue
                label="Eligibility reason"
                value={packageValue(auditPackage.recipientDisclosure?.eligibilityReason)}
              />
              <KeyValue
                label="Compliance status"
                value={packageValue(auditPackage.recipientDisclosure?.complianceStatus)}
              />
              <KeyValue
                label="Payout address"
                value={packageValue(auditPackage.recipientDisclosure?.payoutAddress)}
              />
              <KeyValue label="Proof verified" value={String(auditPackage.proofVerified)} />
              <KeyValue label="Demo-only package" value={String(Boolean(auditPackage.demoOnly))} />
              <KeyValue label="Preview package" value={String(Boolean(auditPackage.previewOnly))} />
            </dl>
          ) : (
            <div className="p-5">
              <EmptyState title={NO_PACKAGE}>
                Auditor-only recipient fields stay hidden until a package is loaded.
              </EmptyState>
            </div>
          )}
        </Panel>
      </div>

      <TechnicalDetails title="Paste or inspect disclosure JSON">
        <div className="grid gap-4">
          <textarea
            value={rawPackage}
            onChange={(event) => setRawPackage(event.target.value)}
            className="min-h-40 rounded-xl border border-white/10 bg-[#071012] p-3 font-mono text-xs leading-5 text-white outline-none focus:border-[#69e6cf]"
            placeholder="Paste a demo disclosure package JSON here, or load the local package after a successful claim."
            spellCheck={false}
          />
          {auditPackage ? <CodeBlock value={auditPackage} /> : null}
        </div>
      </TechnicalDetails>
    </div>
  );
}
