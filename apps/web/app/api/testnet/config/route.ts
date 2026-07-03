import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function findRepoRoot(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(current, "deployments"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return resolve(process.cwd(), "..", "..");
}

export async function GET() {
  const activePath = join(findRepoRoot(), "deployments", "active-testnet.json");
  if (!existsSync(activePath)) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "Missing deployments/active-testnet.json. Run pnpm stellar:fresh-campaign:testnet."
      },
      { status: 404 }
    );
  }

  const active = JSON.parse(await readFile(activePath, "utf8")) as {
    network?: string;
    complianceRoot?: string;
    verifierInfo?: { verificationKeyHash?: string };
  };
  if (active.network !== "testnet") {
    return NextResponse.json(
      {
        status: "error",
        message: "Active deployment is not a testnet deployment."
      },
      { status: 409 }
    );
  }

  if (!active.complianceRoot) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Active deployment predates the compliance-root protocol. Run pnpm stellar:fresh-aidusd-campaign:testnet, or pnpm stellar:fresh-payout-campaign:testnet for native XLM fallback, after setting STELLAR_SOURCE_ACCOUNT."
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    status: "ready",
    active
  });
}
