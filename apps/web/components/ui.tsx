import { clsx } from "clsx";

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
        "min-w-0 rounded-lg border border-[#26313d] bg-[#0d1116]/95 shadow-[0_18px_80px_rgba(0,0,0,0.22)]",
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
    <div className="flex flex-col gap-3 border-b border-[#202a34] p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-normal text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[#93a4ad]">{description}</p> : null}
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#51d6ff]/50 focus:ring-offset-2 focus:ring-offset-[#080a0d] disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-[#51d6ff] text-[#031016] shadow-[0_0_24px_rgba(81,214,255,0.16)] hover:bg-[#85e4ff]",
        variant === "secondary" &&
          "border border-[#2b3845] bg-[#111820] text-white hover:border-[#4a5d6b] hover:bg-[#16222b]",
        variant === "danger" && "bg-[#ff6b6b] text-[#170606] hover:bg-[#ff8c8c]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Metric({
  label,
  value,
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  tone?: "neutral" | "cyan" | "green" | "amber" | "red";
}) {
  const color = {
    neutral: "text-white",
    cyan: "text-[#51d6ff]",
    green: "text-[#5df0a3]",
    amber: "text-[#ffc857]",
    red: "text-[#ff6b6b]"
  }[tone];

  return (
    <div
      className={clsx(
        "min-w-0 rounded-lg border border-[#26313d] bg-[#10161d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
      {...props}
    >
      <div className="text-xs font-medium uppercase text-[#93a4ad]">{label}</div>
      <div className={clsx("mt-2 text-2xl font-semibold", color)}>{value}</div>
    </div>
  );
}

export function KeyValue({
  label,
  value,
  masked = false,
  redacted = false
}: {
  label: string;
  value: string | number | null | undefined;
  masked?: boolean;
  redacted?: boolean;
}) {
  const display = value === null || value === undefined ? "none" : String(value);
  const shown = redacted ? "Hidden until demo reveal is enabled" : masked ? maskValue(display) : display;

  return (
    <div className="grid gap-1 border-b border-[#202a34] py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase text-[#93a4ad]">{label}</dt>
      <dd className="break-all font-mono text-xs leading-5 text-[#d8e7ec]">{shown}</dd>
    </div>
  );
}

export function StatusDot({
  tone = "neutral",
  label
}: {
  tone?: "neutral" | "cyan" | "green" | "amber" | "red";
  label: string;
}) {
  const color = {
    neutral: "bg-[#566673]",
    cyan: "bg-[#51d6ff]",
    green: "bg-[#5df0a3]",
    amber: "bg-[#ffc857]",
    red: "bg-[#ff6b6b]"
  }[tone];

  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#d8e7ec]">
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
    label: "Real local ZK proof",
    description: "Groth16 proof generation and local snarkjs verification.",
    tone: "green"
  },
  real_on_chain: {
    label: "Real on-chain verification",
    description: "Soroban BN254 Groth16 verifier for the deployed testnet path.",
    tone: "cyan"
  },
  dev_on_chain: {
    label: "Dev-only on-chain verifier",
    description: "Browser demo uses a dev_verifier envelope; this is not production ZK.",
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
    green: "border-[#5df0a3]/45 bg-[#5df0a3]/10 text-[#c9ffe2]",
    cyan: "border-[#51d6ff]/45 bg-[#51d6ff]/10 text-[#cff5ff]",
    amber: "border-[#ffc857]/50 bg-[#ffc857]/10 text-[#ffe4a3]"
  }[copy.tone];

  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      <span
        className={clsx(
          "inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold",
          toneClass
        )}
      >
        <span
          className={clsx(
            "h-2 w-2 rounded-full",
            copy.tone === "green" && "bg-[#5df0a3]",
            copy.tone === "cyan" && "bg-[#51d6ff]",
            copy.tone === "amber" && "bg-[#ffc857]"
          )}
        />
        {copy.label}
      </span>
      {showDescription ? (
        <span className="max-w-md text-xs leading-5 text-[#93a4ad]">{copy.description}</span>
      ) : null}
    </span>
  );
}

export function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-[#26313d] bg-[#080b0f] p-4 text-xs leading-5 text-[#d8e7ec]">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function maskValue(value: string): string {
  if (value.length <= 12) {
    return "••••••";
  }

  return `${value.slice(0, 8)}••••${value.slice(-6)}`;
}
