import Link from "next/link";
import {
  BadgeCheck,
  HandCoins,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { HomeNav } from "@/components/app-shell";
import { Button, Panel } from "@/components/ui";

const proofPoints = [
  {
    title: "Privacy by default",
    text: "Zero-knowledge proofs protect personal data",
    icon: ShieldCheck
  },
  {
    title: "Verifiable & transparent",
    text: "Soroban-verified logic and public accountability",
    icon: BadgeCheck
  },
  {
    title: "Human-first design",
    text: "Dignity, clarity, and access for all",
    icon: HandCoins
  }
];

export default function Home() {
  return (
    <Panel className="relative min-h-[calc(100vh-7.4rem)] overflow-hidden rounded-[1.35rem] bg-[#071018]/90">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_82%,rgba(105,230,207,0.20),transparent_26rem),linear-gradient(180deg,rgba(7,16,24,0.35),rgba(4,9,14,0.94))]" />
      <div className="absolute inset-x-[-12%] bottom-[6.5rem] h-36 rounded-[50%] border-t border-[#69e6cf]/65 bg-[radial-gradient(ellipse_at_center,rgba(105,230,207,0.22),transparent_56%)] blur-[1px]" />
      <div className="relative z-10">
        <HomeNav />
        <section className="mx-auto flex min-h-[32rem] max-w-5xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
          <h1 className="text-balance text-5xl font-semibold leading-[1.06] text-white sm:text-6xl lg:text-7xl">
            Private aid payouts.
            <span className="block text-[#73dfce]">Public accountability.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[#bac9cf] sm:text-lg">
            Lumen lets recipients prove eligibility and compliance clearance in zero knowledge,
            then receive AIDUSD from a Soroban-verified campaign escrow.
          </p>
          <div className="mt-8 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
            <Link href="/demo">
              <Button className="w-full min-w-40 sm:w-auto">
                <Sparkles className="h-4 w-4" />
                Open command center
              </Button>
            </Link>
            <Link href="/recipient">
              <Button variant="secondary" className="w-full min-w-40 sm:w-auto">
                How it works
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid border-t border-white/10 bg-[#061018]/35 px-5 py-5 sm:px-8 lg:grid-cols-3">
          {proofPoints.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-4 border-white/10 py-3 lg:border-r lg:px-10 lg:last:border-r-0"
              >
                <Icon className="mt-1 h-8 w-8 shrink-0 text-[#d9f4ef]" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-1 max-w-56 text-sm leading-5 text-[#aebdc5]">{item.text}</p>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </Panel>
  );
}
