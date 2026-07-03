export function shortenAddress(value: string | null | undefined, start = 6, end = 4): string {
  if (!value) {
    return "Not available yet";
  }
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatAmount(
  value: string | number | null | undefined,
  assetCode = "AIDUSD"
): string {
  if (value === null || value === undefined || value === "") {
    return "Not available yet";
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return `${value} ${assetCode}`;
  }
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(numeric)} ${assetCode}`;
}

export function formatStatus(value: string | null | undefined): string {
  if (!value) {
    return "Not available yet";
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  await navigator.clipboard.writeText(value);
  return true;
}
