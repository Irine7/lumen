"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bug,
  ClipboardCheck,
  HandCoins,
  LayoutDashboard,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui";

const nav = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/demo", label: "Demo", icon: Sparkles },
  { href: "/operator", label: "Operator", icon: ShieldCheck },
  { href: "/recipient", label: "Recipient", icon: HandCoins },
  { href: "/donor", label: "Donor", icon: LayoutDashboard },
  { href: "/auditor", label: "Auditor", icon: ClipboardCheck },
  { href: "/debug", label: "Debug", icon: Bug }
];

export function LogoMark() {
  return (
    <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <Image src="/logo.png" alt="Lumen logo" width={32} height={32} className="object-contain" />
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060b0d]/82 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <LogoMark />
              <span>
                <span className="block text-base font-semibold text-white">Lumen</span>
                <span className="block text-xs text-[#9fb0bb]">
                  private aid accountability
                </span>
              </span>
            </Link>

            <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/50 focus:ring-offset-2 focus:ring-offset-[#050608]",
                      active
                        ? "bg-white/[0.11] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-[#9fb0bb] hover:bg-white/[0.07] hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <StatusPill tone="cyan">AIDUSD testnet</StatusPill>
            <StatusPill tone="green">Soroban verifier: real_groth16</StatusPill>
            <StatusPill tone="cyan">Browser ZK: Groth16</StatusPill>
            <StatusPill tone="amber">Disclosure: testnet prototype</StatusPill>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
