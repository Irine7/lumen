"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bug, HandCoins, LayoutDashboard, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

const nav = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/operator", label: "Operator", icon: ShieldCheck },
  { href: "/recipient", label: "Recipient", icon: HandCoins },
  { href: "/donor", label: "Donor", icon: LayoutDashboard },
  { href: "/debug", label: "Debug", icon: Bug }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#202a34] bg-[#050608]/88 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#2e4250] bg-[#0e141a] text-sm font-semibold text-[#51d6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              L
            </span>
            <span>
              <span className="block text-base font-semibold text-white">
                Lumen
              </span>
              <span className="block text-xs text-[#93a4ad]">private aid accountability</span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#51d6ff]/50 focus:ring-offset-2 focus:ring-offset-[#050608]",
                    active
                      ? "border border-[#2f4350] bg-[#111a22] text-white"
                      : "border border-transparent text-[#93a4ad] hover:border-[#26313d] hover:bg-[#0d1116] hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
