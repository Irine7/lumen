"use client";

import { useEffect, useState } from "react";
import { Eye, FileCheck2, LockKeyhole, RefreshCw } from "lucide-react";
import {
  Button,
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
    recipientName?: string;
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

  const packageType = auditPackage ? "Claim package loaded" : NO_PACKAGE;
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
              <StatusPill tone={auditPackage ? "green" : "neutral"}>{packageType}</StatusPill>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Auditor disclosure
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#bac9cf]">
              Selective disclosure for scoped review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="secondary" onClick={loadStoredPackage}>
              <RefreshCw className="h-4 w-4" />
              Load claim package
            </Button>
            <Button type="button" onClick={parseTypedPackage}>
              <FileCheck2 className="h-4 w-4" />
              Verify package
            </Button>
          </div>
        </div>
      </Panel>

      <div data-testid="auditor-package-status">
        {!auditPackage ? (
          <EmptyState title="No disclosure package loaded yet.">
            After a successful claim, load the claim package to inspect scoped auditor evidence.
          </EmptyState>
        ) : (
          <DisclosureBanner title="Disclosure package loaded" tone="cyan">
            Claim evidence is available for scoped auditor review.
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
            description="Auditor-only evidence; not public by default."
            action={<Eye className="h-5 w-5 text-[#78f1b2]" />}
          />
          {auditPackage ? (
            <dl className="p-5">
              <KeyValue
                label="Recipient"
                value={packageValue(
                  auditPackage.recipientDisclosure?.recipientName ??
                    auditPackage.recipientDisclosure?.demoRecipientName
                )}
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
            placeholder="Paste a disclosure package JSON here, or load the claim package after a successful claim."
            spellCheck={false}
          />
        </div>
      </TechnicalDetails>
    </div>
  );
}
