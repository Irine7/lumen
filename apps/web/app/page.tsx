import Link from "next/link";
import {
  ArrowRight,
  Fingerprint,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ShieldCheck,
  Trees,
  WalletCards
} from "lucide-react";
import {
  buildDemoComplianceTree,
  buildDemoEligibilityTree,
  createDemoCampaignConfig
} from "@lumen-aid/merkle";
import { Button, KeyValue, Metric, Panel, PanelHeader, StatusDot } from "@/components/ui";
import { getPublicTestnetStatus, readPublicStellarEnv } from "@/lib/testnet-state";

const flowCards = [
  {
    icon: Trees,
    title: "Prove eligibility privately",
    text: "The browser proves membership in the public eligibility root without sending identity data or Merkle paths."
  },
  {
    icon: ShieldCheck,
    title: "Prove compliance clearance privately",
    text: "A second Merkle proof shows demo clearance status while the compliance witness stays local."
  },
  {
    icon: Fingerprint,
    title: "Bind proof to payout address",
    text: "The proof includes a public payout_account_hash so a relayer cannot redirect funds."
  },
  {
    icon: HandCoins,
    title: "Receive AIDUSD testnet payout after Soroban verification",
    text: "The campaign transfers AIDUSD/SAC escrow only after verifier and campaign checks pass."
  }
];

const statusBadges = [
  ["Browser Groth16", "live", "green"],
  ["Soroban verifier", "real_groth16", "cyan"],
  ["Asset", "AIDUSD testnet SAC", "green"],
  ["Trusted setup", "development", "amber"],
  ["Audit", "not production audited", "amber"]
] as const;

const architecture = [
  { label: "Operator", detail: "publishes roots", icon: ShieldCheck },
  { label: "Recipient", detail: "proves privately", icon: Fingerprint },
  { label: "Relayer", detail: "sends public payload", icon: WalletCards },
  { label: "Soroban", detail: "verifies and pays", icon: Landmark },
  { label: "Donor/auditor", detail: "review public and scoped evidence", icon: LayoutDashboard }
];

export default function Home() {
  const tree = buildDemoEligibilityTree();
  const complianceTree = buildDemoComplianceTree();
  const campaign = createDemoCampaignConfig(tree, complianceTree);
  const testnetStatus = getPublicTestnetStatus(readPublicStellarEnv());

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-stretch">
        <div className="flex min-h-[520px] flex-col justify-between py-2">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex rounded-lg border border-[#26313d] bg-[#10161d] px-3 py-2">
                <StatusDot tone={testnetStatus.tone} label={testnetStatus.label} />
              </span>
              {statusBadges.map(([label, value, tone]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#26313d] bg-[#10161d] px-3 py-2 text-xs font-semibold text-[#d8e7ec]"
                >
                  <span
                    className={
                      tone === "green"
                        ? "h-2 w-2 rounded-full bg-[#5df0a3]"
                        : tone === "cyan"
                          ? "h-2 w-2 rounded-full bg-[#51d6ff]"
                          : "h-2 w-2 rounded-full bg-[#ffc857]"
                    }
                  />
                  {label}: {value}
                </span>
              ))}
            </div>

            <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">
              Lumen
            </h1>
            <p className="mt-5 max-w-3xl text-xl leading-8 text-[#d8e7ec] sm:text-2xl">
              Private, ZK-compliant aid disbursements on Stellar.
            </p>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-[#a7b7c0] sm:text-base">
              Recipients prove eligibility and demo compliance clearance in the browser, bind
              the proof to a public payout address, and receive AIDUSD testnet value only after
              Soroban verification.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Link href="/demo">
              <Button className="w-full">
                <LayoutDashboard className="h-4 w-4" />
                Open demo
              </Button>
            </Link>
            <Link href="/recipient">
              <Button variant="secondary" className="w-full">
                <HandCoins className="h-4 w-4" />
                Claim as recipient
              </Button>
            </Link>
            <Link href="/donor">
              <Button variant="secondary" className="w-full">
                <ArrowRight className="h-4 w-4" />
                View donor state
              </Button>
            </Link>
          </div>
        </div>

        <Panel className="self-stretch">
          <PanelHeader
            title="Validated AIDUSD flow"
            description="Current active testnet campaign uses the compliance-aware 10-public-input proof."
          />
          <div className="grid gap-4 p-5">
            <Metric label="Public inputs" value="10" tone="cyan" />
            <Metric label="Private witness fields" value="17" />
            <Metric label="Eligible demo leaves" value={tree.eligibleRecipients.length.toString()} tone="green" />
            <Metric label="Cleared demo leaves" value={complianceTree.compliantRecipients.length.toString()} tone="green" />
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <StatusDot tone="green" label="AIDUSD live testnet payout validated" />
              <div className="mt-4 grid gap-0">
                <KeyValue label="Eligibility root" value={campaign.eligibilityRoot} />
                <KeyValue label="Compliance root" value={campaign.complianceRoot} />
                <KeyValue label="Policy hash" value={campaign.policyHash} />
                <KeyValue label="Payout binding" value="payout_account_hash public input" />
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {flowCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-lg border border-[#26313d] bg-[#0f1318] p-5">
              <Icon className="h-5 w-5 text-[#51d6ff]" />
              <h2 className="mt-4 text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#93a4ad]">{item.text}</p>
            </div>
          );
        })}
      </section>

      <Panel>
        <PanelHeader
          title="Product flow"
          description="The chain sees commitments, public payout data, and aggregate accounting, not recipient witness data."
        />
        <div className="grid gap-3 p-5 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {architecture.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="contents">
                <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
                  <Icon className="h-5 w-5 text-[#51d6ff]" />
                  <h2 className="mt-4 text-sm font-semibold text-white">{item.label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#93a4ad]">{item.detail}</p>
                </div>
                {index < architecture.length - 1 ? (
                  <div className="hidden items-center text-[#637582] lg:flex" aria-hidden="true">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
