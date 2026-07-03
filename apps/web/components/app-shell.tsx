"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardCheck,
  Database,
  HandCoins,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { clsx } from "clsx";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/demo", label: "Command Center", icon: Sparkles },
  { href: "/operator", label: "Campaigns", icon: ShieldCheck },
  { href: "/recipient", label: "Claims", icon: HandCoins },
  { href: "/auditor", label: "Verifiers", icon: ClipboardCheck },
  { href: "/donor", label: "Donors", icon: LayoutDashboard }
];

const homeNav = [
  { href: "/demo", label: "How it works" },
  { href: "/recipient", label: "For recipients" },
  { href: "/donor", label: "For donors" },
  { href: "/auditor", label: "Docs" }
];

const statusItems = [
  { label: "AIDUSD testnet", icon: Database },
  { label: "Soroban verifier: real_groth16", icon: Activity },
  { label: "Browser ZK: Groth16", icon: ShieldCheck },
  { label: "Proof-bound payouts", icon: HandCoins }
];

export function LogoMark() {
  return (
    <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <Image src="/logo.png" alt="Lumen logo" width={32} height={32} className="object-contain" />
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <div className="min-h-screen px-3 pb-24 pt-3 sm:px-5">
        <main className="mx-auto w-full max-w-[1480px]">{children}</main>
        <StatusDock />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 pb-24 pt-3 sm:px-5">
      <div className="mx-auto grid w-full max-w-[1480px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#0a1218]/86 shadow-[0_28px_110px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-white/10 bg-[#061017]/78 p-5 lg:min-h-[calc(100vh-7.7rem)] lg:border-b-0 lg:border-r">
          <Link href="/" className="block">
            <span className="block text-3xl font-semibold leading-none tracking-normal text-white">
              Lumen
            </span>
            <span className="mt-1 block text-xs text-[#9fb0bb]">private aid accountability</span>
          </Link>

          <nav className="mt-7 flex w-full min-w-0 gap-1 overflow-x-auto lg:grid lg:overflow-visible">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex h-11 shrink-0 items-center gap-3 rounded-lg border px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/45 focus:ring-offset-2 focus:ring-offset-[#050608]",
                    active
                      ? "border-[#69e6cf]/55 bg-[#123a38]/72 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border-transparent text-[#b9c7cd] hover:border-white/10 hover:bg-white/[0.055] hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 hidden rounded-xl border border-white/10 bg-white/[0.055] p-4 lg:block lg:mt-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Network status</div>
                <div className="mt-1 text-xs text-[#9fb0bb]">Stellar testnet</div>
              </div>
              <span className="h-2 w-2 rounded-full bg-[#69e6cf]" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 bg-[radial-gradient(circle_at_18%_0%,rgba(105,230,207,0.10),transparent_24rem),linear-gradient(135deg,rgba(14,27,36,0.92),rgba(8,15,20,0.94))]">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <LogoMark />
              <span className="min-w-0">
                <span className="block text-base font-semibold text-white">Lumen</span>
                <span className="block text-xs text-[#9fb0bb]">private aid accountability</span>
              </span>
            </Link>
            <Settings className="h-4 w-4 text-[#dce7eb]" aria-hidden="true" />
          </header>
          <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <StatusDock />
    </div>
  );
}

export function HomeNav() {
  return (
    <header className="flex flex-col gap-5 border-b border-white/10 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
      <Link href="/" className="block">
        <span className="block text-3xl font-semibold leading-none tracking-normal text-white">
          Lumen
        </span>
        <span className="mt-1 block text-xs text-[#9fb0bb]">private aid accountability</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-x-10 gap-y-3 text-sm text-[#b8c8ce]">
        {homeNav.map((item) => (
          <Link key={item.href} href={item.href} className="transition hover:text-white">
            {item.label}
          </Link>
        ))}
        <Link
          href="/demo"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#69e6cf]/45 px-5 text-sm font-semibold text-[#bff8ee] transition hover:bg-[#69e6cf]/10"
        >
          Open app
        </Link>
      </nav>
    </header>
  );
}

function StatusDock() {
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 mx-auto w-[calc(100%-1.5rem)] max-w-[1400px] overflow-x-auto rounded-xl border border-white/10 bg-[#121c24]/90 shadow-[0_16px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:inset-x-5 sm:w-[calc(100%-2.5rem)]">
      <div className="grid min-w-[760px] grid-cols-4 divide-x divide-white/10">
        {statusItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex min-h-14 items-center gap-3 px-4 text-[#dce7eb]">
              <Icon className="h-6 w-6 shrink-0 text-[#dce7eb]" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm sm:text-base">{item.label}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#69e6cf]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
