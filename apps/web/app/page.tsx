import Link from "next/link";
import {
  BadgeCheck,
  CircleDollarSign,
  Fingerprint,
  HandCoins,
  Landmark,
  Link2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import {
  Button,
  InfoCard,
  KeyValue,
  Panel,
  StatusPill,
  StepCard,
  TechnicalDetails
} from "@/components/ui";
import { activeDeployment } from "@/lib/deployment";
import { shortenAddress } from "@/lib/format";

const productCards = [
  {
    title: "Prove eligibility privately",
    text: "Recipients prove they belong in the campaign set without publishing identity data.",
    icon: Fingerprint
  },
  {
    title: "Prove compliance clearance privately",
    text: "Scoped clearance can be checked without turning the donor view into a personal dossier.",
    icon: BadgeCheck
  },
  {
    title: "Bind proof to payout address",
    text: "The public claim ties the proof to the intended recipient account, blocking payout swaps.",
    icon: Link2
  },
  {
    title: "Release AIDUSD after Soroban verification",
    text: "Campaign rules, nullifiers, and escrow movement stay accountable on the public rail.",
    icon: CircleDollarSign
  }
];

const flow = [
  { title: "Recipient proof", description: "Eligibility and clearance without identity exposure" },
  { title: "Soroban verifier", description: "Groth16 verifier path for the active testnet deployment" },
  { title: "Campaign escrow", description: "Nullifier, cap, budget, and payout checks" },
  { title: "AIDUSD payout", description: "Proof-bound recipient receives aid" },
  { title: "Donor dashboard", description: "Public aggregate accountability" }
];

export default function Home() {
  return (
    <div className="grid gap-10">
      <section className="grid min-h-[calc(100vh-12rem)] gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="max-w-3xl">
          <div className="mb-6 flex flex-wrap gap-2">
            <StatusPill tone="cyan">AIDUSD testnet deployment configured</StatusPill>
            <StatusPill tone="green">Verifier: {activeDeployment.verifierMode}</StatusPill>
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Private aid payouts.
            <span className="block text-[#bff8ee]">Public accountability.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#bac9cf] sm:text-xl">
            Lumen lets recipients prove eligibility and compliance clearance in zero knowledge,
            then receive AIDUSD from a Soroban-verified campaign escrow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo">
              <Button className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                Open demo command center
              </Button>
            </Link>
            <Link href="/recipient">
              <Button variant="secondary" className="w-full sm:w-auto">
                <HandCoins className="h-4 w-4" />
                Start recipient claim
              </Button>
            </Link>
          </div>
        </div>

        <Panel className="overflow-hidden">
          <div className="border-b border-white/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Aid rail at a glance</h2>
                <p className="mt-1 text-sm leading-6 text-[#9fb0bb]">
                  Human-readable state for judges, with technical IDs tucked away.
                </p>
              </div>
              <StatusPill tone="green">Ready for demo</StatusPill>
            </div>
          </div>
          <div className="grid gap-3 p-5">
            {flow.map((item, index) => (
              <StepCard
                key={item.title}
                number={(index + 1).toString()}
                title={item.title}
                description={item.description}
                status={index === 0 ? "Private" : index === flow.length - 1 ? "Public" : "Verified"}
                tone={index === 0 ? "cyan" : index === flow.length - 1 ? "green" : "neutral"}
              />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {productCards.map((item) => (
          <InfoCard key={item.title} title={item.title} icon={item.icon} tone="cyan">
            {item.text}
          </InfoCard>
        ))}
      </section>

      <Panel>
        <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-6">
          <InfoCard title="Built for accountable privacy" icon={ShieldCheck} tone="green">
            Donors see aggregate distribution state. Recipients do not have to publish the facts
            that made them eligible for aid.
          </InfoCard>
          <InfoCard title="Active testnet footprint" icon={Landmark} tone="cyan">
            The current metadata points at campaign{" "}
            <span className="font-mono">
              {shortenAddress(activeDeployment.campaignContractId)}
            </span>{" "}
            and verifier{" "}
            <span className="font-mono">
              {shortenAddress(activeDeployment.verifierContractId)}
            </span>.
          </InfoCard>
        </div>
        <div className="px-5 pb-5 lg:px-6 lg:pb-6">
          <TechnicalDetails title="View deployment details">
            <dl>
              <KeyValue label="Campaign contract" value={activeDeployment.campaignContractId} />
              <KeyValue label="Verifier contract" value={activeDeployment.verifierContractId} />
              <KeyValue label="AIDUSD/SAC contract" value={activeDeployment.tokenContractId} />
              <KeyValue label="Campaign ID" value={activeDeployment.campaignId} />
              <KeyValue label="Verification key hash" value={activeDeployment.verificationKeyHash} />
            </dl>
          </TechnicalDetails>
        </div>
      </Panel>

      <div className="pb-2 text-sm leading-6 text-[#9fb0bb]">
        Testnet prototype. Not production readiness, not production view keys, and not an audited
        humanitarian compliance system.
      </div>
    </div>
  );
}
