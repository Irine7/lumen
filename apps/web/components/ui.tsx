import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

type Tone = "neutral" | "cyan" | "green" | "amber" | "red";

export function Panel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "min-w-0 rounded-xl border border-white/10 bg-[#121d26]/82 shadow-[0_24px_90px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold leading-tight tracking-normal text-white">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#aebdc5]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "bg-gradient-to-b from-[#73ead7] to-[#42bcb1] text-[#031312] shadow-[0_16px_44px_rgba(105,230,207,0.2)] hover:from-[#8cf4df] hover:to-[#55c9bd]",
        variant === "secondary" &&
          "border border-white/10 bg-[#0b151d]/70 text-white hover:border-[#69e6cf]/35 hover:bg-white/[0.075]",
        variant === "danger" && "bg-[#ff7b7b] text-[#170606] hover:bg-[#ff9a9a]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" {...props} />;
}

export function Metric({
  label,
  value,
  tone = "neutral",
  detail,
  testId,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  tone?: Tone;
  detail?: string | undefined;
  testId?: string | undefined;
}) {
  const color = {
    neutral: "text-white",
    cyan: "text-[#69e6cf]",
    green: "text-[#78f1b2]",
    amber: "text-[#ffd36e]",
    red: "text-[#ff8b8b]"
  }[tone];

  return (
    <div
      data-testid={testId}
      className={clsx(
        "min-w-0 rounded-xl border border-white/10 bg-[#17242f]/82 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)]",
        className
      )}
      {...props}
    >
      <div className="text-sm font-medium normal-case tracking-normal text-[#c1cdd3]">
        {label}
      </div>
      <div className={clsx("mt-2 break-words text-3xl font-semibold leading-tight", color)}>
        {value}
      </div>
      {detail ? <div className="mt-1 text-sm leading-5 text-[#aebdc5]">{detail}</div> : null}
    </div>
  );
}

export const MetricCard = Metric;

export function InfoCard({
  title,
  children,
  icon,
  tone = "neutral",
  className
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: Tone;
  className?: string;
}) {
  const Icon = icon;
  const toneClass = {
    neutral: "text-[#dce7eb]",
    cyan: "text-[#69e6cf]",
    green: "text-[#78f1b2]",
    amber: "text-[#ffd36e]",
    red: "text-[#ff8b8b]"
  }[tone];

  return (
    <div className={clsx("rounded-xl border border-white/10 bg-[#111c25]/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.055]">
            <Icon className={clsx("h-5 w-5", toneClass)} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <div className="mt-2 text-sm leading-6 text-[#bac9cf]">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function KeyValue({
  label,
  value,
  masked = false,
  redacted = false,
  emptyLabel = "Not available yet"
}: {
  label: string;
  value: string | number | null | undefined;
  masked?: boolean;
  redacted?: boolean;
  emptyLabel?: string;
}) {
  const display =
    value === null || value === undefined || value === "" ? emptyLabel : String(value);
  const shown = redacted
    ? "Hidden until reveal is enabled"
    : masked
      ? maskValue(display)
      : display;

  return (
    <div className="grid gap-1 border-b border-white/10 py-3 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9fb0bb]">
        {label}
      </dt>
      <dd className="break-all font-mono text-xs leading-5 text-[#dce7eb]">{shown}</dd>
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
  className
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    neutral: "border-white/10 bg-white/[0.055] text-[#dce7eb]",
    cyan: "border-[#69e6cf]/35 bg-[#69e6cf]/10 text-[#cafff4]",
    green: "border-[#78f1b2]/35 bg-[#78f1b2]/10 text-[#d5ffe8]",
    amber: "border-[#ffd36e]/40 bg-[#ffd36e]/10 text-[#ffe9ac]",
    red: "border-[#ff8b8b]/40 bg-[#ff8b8b]/10 text-[#ffd0d0]"
  }[tone];

  return (
    <span
      className={clsx(
        "inline-flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        toneClass,
        className
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          tone === "neutral" && "bg-[#9fb0bb]",
          tone === "cyan" && "bg-[#69e6cf]",
          tone === "green" && "bg-[#78f1b2]",
          tone === "amber" && "bg-[#ffd36e]",
          tone === "red" && "bg-[#ff8b8b]"
        )}
      />
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "neutral",
  label
}: {
  tone?: Tone;
  label: string;
}) {
  const color = {
    neutral: "bg-[#7d8d96]",
    cyan: "bg-[#69e6cf]",
    green: "bg-[#78f1b2]",
    amber: "bg-[#ffd36e]",
    red: "bg-[#ff8b8b]"
  }[tone];

  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#dce7eb]">
      <span className={clsx("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

export type VerifierStatus = "real_local_zk" | "real_on_chain" | "dev_on_chain";

const verifierStatusCopy: Record<
  VerifierStatus,
  {
    label: string;
    description: string;
    tone: "green" | "cyan" | "amber";
  }
> = {
  real_local_zk: {
    label: "Browser ZK proof",
    description: "Groth16 proof generation and browser verification.",
    tone: "green"
  },
  real_on_chain: {
    label: "Soroban verifier: real_groth16",
    description: "Soroban BN254 Groth16 verifier for the deployed testnet path.",
    tone: "cyan"
  },
  dev_on_chain: {
    label: "On-chain verifier",
    description: "Soroban verifier path for claim validation.",
    tone: "amber"
  }
};

export function VerifierStatusBadge({
  status,
  showDescription = false
}: {
  status: VerifierStatus;
  showDescription?: boolean;
}) {
  const copy = verifierStatusCopy[status];
  const toneClass = {
    green: "border-[#78f1b2]/45 bg-[#78f1b2]/10 text-[#d5ffe8]",
    cyan: "border-[#69e6cf]/45 bg-[#69e6cf]/10 text-[#cafff4]",
    amber: "border-[#ffd36e]/50 bg-[#ffd36e]/10 text-[#ffe9ac]"
  }[copy.tone];

  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      <span
        className={clsx(
          "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
          toneClass
        )}
      >
        <span
          className={clsx(
            "h-2 w-2 rounded-full",
            copy.tone === "green" && "bg-[#78f1b2]",
            copy.tone === "cyan" && "bg-[#69e6cf]",
            copy.tone === "amber" && "bg-[#ffd36e]"
          )}
        />
        {copy.label}
      </span>
      {showDescription ? (
        <span className="max-w-md text-xs leading-5 text-[#9fb0bb]">
          {copy.description}
        </span>
      ) : null}
    </span>
  );
}

export function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-[#071012] p-4 text-xs leading-5 text-[#dce7eb]">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function StepCard({
  number,
  title,
  description,
  status,
  tone = "neutral",
  className
}: {
  number: string;
  title: string;
  description?: string | undefined;
  status?: string | undefined;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "grid gap-3 rounded-xl border border-white/10 bg-[#111c25]/72 p-4 sm:grid-cols-[2.5rem_1fr_auto] sm:items-center",
        className
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-[#17242f] text-xs font-semibold text-[#dce7eb]">
        {number}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-[#9fb0bb]">{description}</div> : null}
      </div>
      {status ? <StatusPill tone={tone}>{status}</StatusPill> : null}
    </div>
  );
}

export function DisclosureBanner({
  title,
  children,
  tone = "amber",
  className
}: {
  title: string;
  children: React.ReactNode;
  tone?: "amber" | "cyan" | "red";
  className?: string;
}) {
  const toneClass = {
    amber: "border-[#ffd36e]/35 bg-[#ffd36e]/10 text-[#ffe9ac]",
    cyan: "border-[#69e6cf]/30 bg-[#69e6cf]/10 text-[#cafff4]",
    red: "border-[#ff8b8b]/35 bg-[#ff8b8b]/10 text-[#ffd0d0]"
  }[tone];

  return (
    <div className={clsx("rounded-xl border p-4", toneClass, className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-1 text-sm leading-6 text-[#dce7eb]">{children}</div>
    </div>
  );
}

export function TechnicalDetails({
  title = "View technical details",
  children,
  defaultOpen = false
}: {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-white/10 bg-white/[0.035] p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#69e6cf]/45">
        {title}
        <ChevronDown className="h-4 w-4 text-[#9fb0bb] transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-4 border-t border-white/10 pt-2">{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#9fb0bb]">
        {children}
      </div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function maskValue(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
