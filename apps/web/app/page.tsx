import Link from "next/link";
import {
  ArrowRight,
  Database,
  Fingerprint,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ShieldCheck,
  Trees
} from "lucide-react";
import { buildDemoEligibilityTree, createDemoCampaignConfig } from "@lumen-aid/merkle";
import {
  Button,
  KeyValue,
  Metric,
  Panel,
  PanelHeader,
  StatusDot,
  VerifierStatusBadge
} from "@/components/ui";
import { getPublicTestnetStatus, readPublicStellarEnv } from "@/lib/testnet-state";

export default function Home() {
  const tree = buildDemoEligibilityTree();
  const campaign = createDemoCampaignConfig(tree);
  const testnetStatus = getPublicTestnetStatus(readPublicStellarEnv());
  const architecture = [
    { label: "Operator", detail: "builds eligibility list", icon: ShieldCheck },
    { label: "Eligibility root", detail: "public Merkle commitment", icon: Trees },
    { label: "Recipient ZK proof", detail: "eligibility without identity", icon: Fingerprint },
    { label: "Soroban campaign contract", detail: "checks claim rules", icon: Landmark },
    { label: "Donor dashboard", detail: "aggregate accountability", icon: LayoutDashboard }
  ];

  return (
    <div className="grid gap-10">
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="flex min-h-[500px] flex-col justify-between py-4">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-lg border border-[#26313d] bg-[#10161d] px-3 py-2">
              <StatusDot tone={testnetStatus.tone} label={testnetStatus.label} />
            </div>
            <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">Lumen</h1>
            <p className="mt-5 text-xl leading-8 text-[#d8e7ec] sm:text-2xl">
              Private aid claims with public accountability on Stellar/Soroban.
            </p>
            <ul className="mt-8 grid gap-3 text-sm leading-6 text-[#a7b7c0] sm:text-base">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d6ff]" />
                Public blockchains expose payment trails that can identify vulnerable recipients.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d6ff]" />
                Humanitarian aid recipients need privacy around identity, eligibility, and timing.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d6ff]" />
                Lumen lets recipients prove eligibility in zero knowledge.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d6ff]" />
                Donors still get aggregate accountability: budget, claims, and blocked abuse.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#51d6ff]" />
                Built on Stellar assets and Soroban campaign contracts.
              </li>
            </ul>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/recipient">
              <Button className="w-full">
                <HandCoins className="h-4 w-4" />
                Run recipient claim
              </Button>
            </Link>
            <Link href="/donor">
              <Button variant="secondary" className="w-full">
                <ArrowRight className="h-4 w-4" />
                View accountability
              </Button>
            </Link>
          </div>
        </div>

        <Panel className="self-stretch">
          <PanelHeader
            title="Live demo campaign"
            description="Deterministic fixtures keep the claim and nullifier flow reproducible for judges."
          />
          <div className="grid gap-4 p-5">
            <Metric label="Budget" value={`$${campaign.budget}`} tone="cyan" />
            <Metric label="Per-recipient cap" value={`$${campaign.perRecipientCap}`} />
            <Metric label="Eligible leaves" value={tree.eligibleRecipients.length.toString()} tone="green" />
            <div className="rounded-lg border border-[#26313d] bg-[#10161d] p-4">
              <StatusDot tone="green" label="Recipient identity is not submitted publicly" />
              <div className="mt-4 grid gap-0">
                <KeyValue label="Eligibility root" value={campaign.eligibilityRoot} />
                <KeyValue label="Policy hash" value={campaign.policyHash} />
                <div className="border-b border-[#202a34] py-3 last:border-b-0">
                  <div className="mb-2 text-xs font-medium uppercase text-[#93a4ad]">
                    Verifier status
                  </div>
                  <div>
                    <VerifierStatusBadge status="dev_on_chain" showDescription />
                  </div>
                </div>
                <KeyValue
                  label="Documented real paths"
                  value="Real local Groth16 scripts and real deployed testnet verification are documented separately."
                />
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <Panel>
        <PanelHeader
          title="Architecture"
          description="The public chain sees commitments and aggregate claim state, not recipient identity data."
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
                  <div
                    key={`${item.label}-arrow`}
                    className="hidden items-center text-[#637582] lg:flex"
                    aria-hidden="true"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          {
            icon: Database,
            title: "Eligibility tree",
            text: "Operator commits to a Merkle root instead of publishing the recipient list."
          },
          {
            icon: Fingerprint,
            title: "Private witness",
            text: "Recipient proves their leaf path and secret-derived commitments locally."
          },
          {
            icon: ShieldCheck,
            title: "Verifier boundary",
            text: "The browser demo is dev-only; real local and testnet verification are tracked in the docs."
          },
          {
            icon: HandCoins,
            title: "Aggregate accountability",
            text: "Donors see total distributed, remaining budget, and blocked duplicates."
          }
        ].map((item) => {
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
    </div>
  );
}
