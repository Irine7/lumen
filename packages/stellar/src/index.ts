import type {
  CampaignConfig,
  CampaignEvent,
  CampaignStats,
  ClaimProofEnvelope,
  ClaimPublicInputs,
  Hex32
} from "@lumen-aid/shared";
import { verifyClaimProofLocally } from "@lumen-aid/prover";
import { Asset, Networks, StrKey, hash as stellarHash } from "@stellar/stellar-sdk";

const DEMO_INITIAL_EVENT_AT = "2026-07-01T00:00:00.000Z";

export interface LumenStellarEnv {
  network: "localnet" | "testnet" | "mainnet";
  rpcUrl: string;
  campaignContractId: string;
  verifierContractId: string;
  mockTokenContractId: string;
}

export interface TestnetCampaignConfig {
  network: "testnet";
  contractId: string;
  campaignId: Hex32;
  operator: string;
  asset: string;
  budget: string;
  perRecipientCap: string;
  eligibilityRoot: Hex32;
  complianceRoot: Hex32;
  denyRoot: Hex32 | null;
  policyHash: Hex32;
  verifierContractId: string;
  startLedger: number;
  endLedger: number;
  isActive: boolean;
}

export interface TestnetCampaignStats {
  network: "testnet";
  contractId: string;
  totalClaimed: string;
  claimCount: number;
  remainingBudget: string;
  duplicateClaimsBlocked: number;
  invalidClaimsBlocked: number;
}

export interface TestnetEscrowBalance {
  network: "testnet";
  contractId: string;
  balance: string;
}

export interface TestnetVerifierStatus {
  network: "testnet";
  contractId: string;
  status: "callable_malformed_rejected";
  mode: "real_groth16" | "dev_verifier" | "legacy_not_introspectable";
  version: "claim_v0" | "unknown";
  verifierId: Hex32 | null;
  circuitId: Hex32 | null;
  verificationKeyHash: Hex32 | null;
  notes: string;
}

export type StellarReadResult<T> =
  | {
      status: "ready";
      data: T;
    }
  | {
      status: "not_configured";
      missing: string[];
      message: string;
    }
  | {
      status: "error";
      error: string;
      message: string;
    };

export interface LumenCampaignSnapshot {
  campaign: CampaignConfig;
  stats: CampaignStats;
  usedNullifiers: Hex32[];
  events: CampaignEvent[];
}

type StellarSdk = typeof import("@stellar/stellar-sdk");
type StellarScVal = ReturnType<StellarSdk["nativeToScVal"]>;

const READ_ONLY_SIMULATION_SOURCE =
  "GDRCC7MJVHXPNTEWV7IT525DPKOBHWOLK2GJB44736OO37IIJVL3WIDD";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalStellarAddressBytes(address: string): Uint8Array {
  const value = address.trim();
  if (StrKey.isValidEd25519PublicKey(value)) {
    return Uint8Array.from(StrKey.decodeEd25519PublicKey(value));
  }
  if (StrKey.isValidContract(value)) {
    return Uint8Array.from(StrKey.decodeContract(value));
  }

  throw new Error("Expected a valid Stellar account or contract address");
}

export function derivePayoutAccountHash(payoutAddress: string): Hex32 {
  const canonical = canonicalStellarAddressBytes(payoutAddress);
  const digest = Uint8Array.from(stellarHash(canonical as Buffer));
  const fieldBytes = new Uint8Array(32);
  fieldBytes.set(digest.slice(0, 31), 1);
  return `0x${bytesToHex(fieldBytes)}` as Hex32;
}

export function nativeTestnetAssetContractId(): string {
  return Asset.native().contractId(Networks.TESTNET);
}

export interface SubmitClaimResult {
  ok: boolean;
  status:
    | "claim_accepted"
    | "duplicate_rejected"
    | "invalid_rejected"
    | "campaign_closed";
  message: string;
  stats: CampaignStats;
}

export function readLumenStellarEnv(
  env: Record<string, string | undefined>
): LumenStellarEnv {
  return {
    network:
      env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ||
      env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? env.NEXT_PUBLIC_STELLAR_NETWORK
        : "localnet",
    rpcUrl: env.NEXT_PUBLIC_RPC_URL ?? "",
    campaignContractId: env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID ?? "",
    verifierContractId: env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? "",
    mockTokenContractId: env.NEXT_PUBLIC_MOCK_TOKEN_CONTRACT_ID ?? ""
  };
}

function notConfigured<T>(missing: string[]): StellarReadResult<T> {
  return {
    status: "not_configured",
    missing,
    message: `Missing testnet read configuration: ${missing.join(", ")}`
  };
}

function readError<T>(error: unknown): StellarReadResult<T> {
  return {
    status: "error",
    error: error instanceof Error ? error.message : String(error),
    message: "Testnet read failed"
  };
}

function missingBaseReadConfig(config: LumenStellarEnv): string[] {
  const missing: string[] = [];
  if (config.network !== "testnet") {
    missing.push("NEXT_PUBLIC_STELLAR_NETWORK=testnet");
  }
  if (!config.rpcUrl) {
    missing.push("NEXT_PUBLIC_RPC_URL");
  }
  if (!config.campaignContractId) {
    missing.push("NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID");
  }

  return missing;
}

function missingVerifierReadConfig(config: LumenStellarEnv): string[] {
  const missing = missingBaseReadConfig(config);
  if (!config.verifierContractId) {
    missing.push("NEXT_PUBLIC_VERIFIER_CONTRACT_ID");
  }

  return missing;
}

async function simulateContractCall(
  config: LumenStellarEnv,
  contractId: string,
  method: string,
  args: StellarScVal[] = []
): Promise<unknown> {
  const sdk: StellarSdk = await import("@stellar/stellar-sdk");
  const server = new sdk.rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://")
  });
  const source = new sdk.Account(READ_ONLY_SIMULATION_SOURCE, "0");
  const contract = new sdk.Contract(contractId);
  const tx = new sdk.TransactionBuilder(source, {
    fee: sdk.BASE_FEE,
    networkPassphrase: sdk.Networks.TESTNET
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(tx);

  if ("error" in simulation && simulation.error) {
    throw new Error(simulation.error);
  }
  if (!("result" in simulation) || !simulation.result) {
    throw new Error(`No simulation result for ${method}`);
  }

  return sdk.scValToNative(simulation.result.retval);
}

function bytesToHex32(value: unknown, label: string): Hex32 {
  if (typeof value === "string") {
    return (value.startsWith("0x") ? value : `0x${value}`) as Hex32;
  }

  if (value instanceof Uint8Array) {
    return `0x${[...value].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  throw new Error(`Expected ${label} to be 32-byte data`);
}

function valueToString(value: unknown, label: string): string {
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
    return value.toString();
  }

  throw new Error(`Expected ${label} to be numeric`);
}

function valueToNumber(value: unknown, label: string): number {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) {
    throw new Error(`Expected ${label} to be numeric`);
  }

  return asNumber;
}

function nullableBytesToHex32(value: unknown, label: string): Hex32 | null {
  return value === null || value === undefined ? null : bytesToHex32(value, label);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const matches = clean.match(/.{2}/g) ?? [];
  return Uint8Array.from(matches.map((byte) => Number.parseInt(byte, 16)));
}

function zeroHex32(): string {
  return "0".repeat(64);
}

function safeSymbol(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function verifierModeFromInfo(value: unknown): "real_groth16" | "dev_verifier" | null {
  const mode = safeSymbol(value);
  if (mode === "real_groth16" || mode === "dev_verifier") {
    return mode;
  }
  return null;
}

async function malformedVerifierArgs(): Promise<StellarScVal[]> {
  const sdk: StellarSdk = await import("@stellar/stellar-sdk");
  const zero = zeroHex32();
  const publicInputs = {
    amount: 1n,
    amount_commitment: hexToBytes(zero),
    campaign_id: hexToBytes(zero),
    compliance_root: hexToBytes(zero),
    eligibility_root: hexToBytes(zero),
    max_amount: 1n,
    nullifier_hash: hexToBytes(zero),
    payout_account_hash: hexToBytes(zero),
    policy_hash: hexToBytes(zero),
    recipient_commitment: hexToBytes(zero)
  };
  const publicInputTypes: Record<string, ["symbol", "i128" | "bytes"]> = {
    amount: ["symbol", "i128"],
    amount_commitment: ["symbol", "bytes"],
    campaign_id: ["symbol", "bytes"],
    compliance_root: ["symbol", "bytes"],
    eligibility_root: ["symbol", "bytes"],
    max_amount: ["symbol", "i128"],
    nullifier_hash: ["symbol", "bytes"],
    payout_account_hash: ["symbol", "bytes"],
    policy_hash: ["symbol", "bytes"],
    recipient_commitment: ["symbol", "bytes"]
  };

  return [
    sdk.nativeToScVal(publicInputs, { type: publicInputTypes }),
    sdk.nativeToScVal(Uint8Array.from([0]), { type: "bytes" })
  ];
}

export async function getCampaignConfig(
  config: LumenStellarEnv
): Promise<StellarReadResult<TestnetCampaignConfig>> {
  const missing = missingBaseReadConfig(config);
  if (missing.length > 0) {
    return notConfigured(missing);
  }

  try {
    const value = (await simulateContractCall(
      config,
      config.campaignContractId,
      "get_campaign"
    )) as Record<string, unknown>;

    return {
      status: "ready",
      data: {
        network: "testnet",
        contractId: config.campaignContractId,
        campaignId: bytesToHex32(value.campaign_id, "campaign_id"),
        operator: String(value.operator),
        asset: String(value.asset),
        budget: valueToString(value.budget, "budget"),
        perRecipientCap: valueToString(value.per_recipient_cap, "per_recipient_cap"),
        eligibilityRoot: bytesToHex32(value.eligibility_root, "eligibility_root"),
        complianceRoot: bytesToHex32(value.compliance_root, "compliance_root"),
        denyRoot: nullableBytesToHex32(value.deny_root, "deny_root"),
        policyHash: bytesToHex32(value.policy_hash, "policy_hash"),
        verifierContractId: String(value.verifier),
        startLedger: valueToNumber(value.start_ledger, "start_ledger"),
        endLedger: valueToNumber(value.end_ledger, "end_ledger"),
        isActive: Boolean(value.is_active)
      }
    };
  } catch (error) {
    return readError(error);
  }
}

async function getTestnetCampaignStats(
  config: LumenStellarEnv
): Promise<StellarReadResult<TestnetCampaignStats>> {
  const missing = missingBaseReadConfig(config);
  if (missing.length > 0) {
    return notConfigured(missing);
  }

  try {
    const value = (await simulateContractCall(
      config,
      config.campaignContractId,
      "get_stats"
    )) as Record<string, unknown>;

    return {
      status: "ready",
      data: {
        network: "testnet",
        contractId: config.campaignContractId,
        totalClaimed: valueToString(value.total_claimed, "total_claimed"),
        claimCount: valueToNumber(value.claim_count, "claim_count"),
        remainingBudget: valueToString(value.remaining_budget, "remaining_budget"),
        duplicateClaimsBlocked: valueToNumber(
          value.duplicate_claims_blocked,
          "duplicate_claims_blocked"
        ),
        invalidClaimsBlocked: valueToNumber(
          value.invalid_claims_blocked,
          "invalid_claims_blocked"
        )
      }
    };
  } catch (error) {
    return readError(error);
  }
}

export async function getCampaignEscrowBalance(
  config: LumenStellarEnv
): Promise<StellarReadResult<TestnetEscrowBalance>> {
  const missing = missingBaseReadConfig(config);
  if (missing.length > 0) {
    return notConfigured(missing);
  }

  try {
    const value = await simulateContractCall(
      config,
      config.campaignContractId,
      "get_escrow_balance"
    );

    return {
      status: "ready",
      data: {
        network: "testnet",
        contractId: config.campaignContractId,
        balance: valueToString(value, "escrow balance")
      }
    };
  } catch (error) {
    return readError(error);
  }
}

export async function getVerifierStatus(
  config: LumenStellarEnv
): Promise<StellarReadResult<TestnetVerifierStatus>> {
  const missing = missingVerifierReadConfig(config);
  if (missing.length > 0) {
    return notConfigured(missing);
  }

  try {
    let info:
      | {
          mode: "real_groth16" | "dev_verifier";
          version: "claim_v0" | "unknown";
          verifierId: Hex32;
          circuitId: Hex32;
          verificationKeyHash: Hex32;
        }
      | null = null;

    try {
      const value = (await simulateContractCall(
        config,
        config.verifierContractId,
        "verifier_info"
      )) as Record<string, unknown>;
      const mode = verifierModeFromInfo(value.mode);
      if (mode) {
        info = {
          mode,
          version: safeSymbol(value.version) === "claim_v0" ? "claim_v0" : "unknown",
          verifierId: bytesToHex32(value.verifier_id, "verifier_id"),
          circuitId: bytesToHex32(value.circuit_id, "circuit_id"),
          verificationKeyHash: bytesToHex32(
            value.verification_key_hash,
            "verification_key_hash"
          )
        };
      }
    } catch {
      info = null;
    }

    const result = await simulateContractCall(
      config,
      config.verifierContractId,
      "verify_claim",
      await malformedVerifierArgs()
    );

    if (result !== false) {
      throw new Error("Verifier unexpectedly accepted a malformed proof");
    }

    return {
      status: "ready",
      data: {
        network: "testnet",
        contractId: config.verifierContractId,
        status: "callable_malformed_rejected",
        mode: info?.mode ?? "legacy_not_introspectable",
        version: info?.version ?? "unknown",
        verifierId: info?.verifierId ?? null,
        circuitId: info?.circuitId ?? null,
        verificationKeyHash: info?.verificationKeyHash ?? null,
        notes: info
          ? `Verifier mode: ${info.mode}; verifier_info returned ${info.version}. Malformed proof simulation returned false.`
          : "Verifier mode: legacy verifier, mode not introspectable. Malformed proof simulation returned false."
      }
    };
  } catch (error) {
    return readError(error);
  }
}

function now(): string {
  return new Date().toISOString();
}

function initialStats(campaign: CampaignConfig): CampaignStats {
  return {
    totalClaimed: 0,
    claimCount: 0,
    remainingBudget: campaign.budget,
    duplicateClaimsBlocked: 0,
    invalidClaimsBlocked: 0,
    lastEvent: null
  };
}

function event(
  type: CampaignEvent["type"],
  message: string,
  extras = {},
  at = now()
): CampaignEvent {
  return {
    type,
    at,
    message,
    ...extras
  };
}

export class LocalLumenSorobanClient {
  private snapshot: LumenCampaignSnapshot;

  constructor(campaign: CampaignConfig, snapshot?: LumenCampaignSnapshot) {
    this.snapshot =
      snapshot ??
      ({
        campaign,
        stats: initialStats(campaign),
        usedNullifiers: [],
        events: [
          event(
            "campaign_initialized",
            "Campaign initialized on local Soroban simulator",
            {},
            DEMO_INITIAL_EVENT_AT
          )
        ]
      } satisfies LumenCampaignSnapshot);
  }

  createCampaign(config: CampaignConfig): CampaignConfig {
    this.snapshot = {
      campaign: config,
      stats: initialStats(config),
      usedNullifiers: [],
      events: [event("campaign_initialized", "Campaign initialized on local Soroban simulator")]
    };
    return config;
  }

  getCampaign(): CampaignConfig {
    return this.snapshot.campaign;
  }

  getCampaignStats(): CampaignStats {
    return this.snapshot.stats;
  }

  getRecentEvents(): CampaignEvent[] {
    return [...this.snapshot.events].reverse().slice(0, 8);
  }

  isNullifierUsed(nullifierHash: Hex32): boolean {
    return this.snapshot.usedNullifiers.some(
      (stored) => stored.toLowerCase() === nullifierHash.toLowerCase()
    );
  }

  updateRoots(
    newEligibilityRoot: Hex32,
    newComplianceRoot: Hex32,
    newDenyRoot: Hex32 | null
  ): CampaignConfig {
    this.snapshot.campaign = {
      ...this.snapshot.campaign,
      eligibilityRoot: newEligibilityRoot,
      complianceRoot: newComplianceRoot,
      denyRoot: newDenyRoot
    };
    this.snapshot.events.push(event("roots_updated", "Operator updated campaign roots"));
    return this.snapshot.campaign;
  }

  closeCampaign(): CampaignConfig {
    this.snapshot.campaign = {
      ...this.snapshot.campaign,
      isActive: false
    };
    const closeEvent = event("campaign_closed", "Campaign closed by operator");
    this.snapshot.events.push(closeEvent);
    this.snapshot.stats = {
      ...this.snapshot.stats,
      lastEvent: closeEvent
    };
    return this.snapshot.campaign;
  }

  async submitClaim(
    publicInputs: ClaimPublicInputs,
    proof: ClaimProofEnvelope,
    payoutAddress?: string
  ): Promise<SubmitClaimResult> {
    const campaign = this.snapshot.campaign;

    const reject = (
      status: SubmitClaimResult["status"],
      message: string,
      nullifierHash?: Hex32
    ): SubmitClaimResult => {
      const rejectEvent = event(
        status === "duplicate_rejected" ? "duplicate_rejected" : "invalid_rejected",
        message,
        nullifierHash ? { nullifierHash } : {}
      );

      this.snapshot.events.push(rejectEvent);
      this.snapshot.stats = {
        ...this.snapshot.stats,
        duplicateClaimsBlocked:
          status === "duplicate_rejected"
            ? this.snapshot.stats.duplicateClaimsBlocked + 1
            : this.snapshot.stats.duplicateClaimsBlocked,
        invalidClaimsBlocked:
          status === "invalid_rejected"
            ? this.snapshot.stats.invalidClaimsBlocked + 1
            : this.snapshot.stats.invalidClaimsBlocked,
        lastEvent: rejectEvent
      };

      return {
        ok: false,
        status,
        message,
        stats: this.snapshot.stats
      };
    };

    if (!campaign.isActive) {
      return reject("campaign_closed", "Campaign is closed", publicInputs.nullifierHash);
    }

    if (publicInputs.campaignId.toLowerCase() !== campaign.campaignId.toLowerCase()) {
      return reject("invalid_rejected", "Wrong campaign id", publicInputs.nullifierHash);
    }

    if (publicInputs.eligibilityRoot.toLowerCase() !== campaign.eligibilityRoot.toLowerCase()) {
      return reject("invalid_rejected", "Wrong eligibility root", publicInputs.nullifierHash);
    }

    if (publicInputs.complianceRoot.toLowerCase() !== campaign.complianceRoot.toLowerCase()) {
      return reject("invalid_rejected", "Wrong compliance root", publicInputs.nullifierHash);
    }

    if (publicInputs.policyHash.toLowerCase() !== campaign.policyHash.toLowerCase()) {
      return reject("invalid_rejected", "Wrong policy hash", publicInputs.nullifierHash);
    }

    if (publicInputs.maxAmount !== campaign.perRecipientCap) {
      return reject("invalid_rejected", "Wrong max amount", publicInputs.nullifierHash);
    }

    if (publicInputs.amount > campaign.perRecipientCap) {
      return reject("invalid_rejected", "Amount exceeds campaign cap", publicInputs.nullifierHash);
    }

    if (this.snapshot.stats.remainingBudget < publicInputs.amount) {
      return reject("invalid_rejected", "Campaign budget exhausted", publicInputs.nullifierHash);
    }

    if (
      payoutAddress &&
      derivePayoutAccountHash(payoutAddress).toLowerCase() !==
        publicInputs.payoutAccountHash.toLowerCase()
    ) {
      return reject(
        "invalid_rejected",
        "Payout address does not match the proof binding",
        publicInputs.nullifierHash
      );
    }

    if (this.isNullifierUsed(publicInputs.nullifierHash)) {
      return reject(
        "duplicate_rejected",
        "Nullifier has already claimed this campaign",
        publicInputs.nullifierHash
      );
    }

    const proofOk = await verifyClaimProofLocally(proof, publicInputs);
    if (!proofOk) {
      return reject("invalid_rejected", "Verifier rejected proof", publicInputs.nullifierHash);
    }

    this.snapshot.usedNullifiers.push(publicInputs.nullifierHash);
    const acceptedEvent = event("claim_accepted", "Claim accepted by campaign contract", {
      nullifierHash: publicInputs.nullifierHash,
      amount: publicInputs.amount
    });

    this.snapshot.events.push(acceptedEvent);
    this.snapshot.stats = {
      totalClaimed: this.snapshot.stats.totalClaimed + publicInputs.amount,
      claimCount: this.snapshot.stats.claimCount + 1,
      remainingBudget: this.snapshot.stats.remainingBudget - publicInputs.amount,
      duplicateClaimsBlocked: this.snapshot.stats.duplicateClaimsBlocked,
      invalidClaimsBlocked: this.snapshot.stats.invalidClaimsBlocked,
      lastEvent: acceptedEvent
    };

    return {
      ok: true,
      status: "claim_accepted",
      message: "Claim accepted",
      stats: this.snapshot.stats
    };
  }

  exportSnapshot(): LumenCampaignSnapshot {
    return {
      ...this.snapshot,
      usedNullifiers: [...this.snapshot.usedNullifiers],
      events: [...this.snapshot.events]
    };
  }
}

export function createLocalLumenClient(
  campaign: CampaignConfig,
  snapshot?: LumenCampaignSnapshot
): LocalLumenSorobanClient {
  return new LocalLumenSorobanClient(campaign, snapshot);
}

export async function createCampaign(
  client: LocalLumenSorobanClient,
  config: CampaignConfig
): Promise<CampaignConfig> {
  return client.createCampaign(config);
}

export async function submitClaim(
  client: LocalLumenSorobanClient,
  publicInputs: ClaimPublicInputs,
  proof: ClaimProofEnvelope,
  payoutAddress?: string
): Promise<SubmitClaimResult> {
  return client.submitClaim(publicInputs, proof, payoutAddress);
}

export function getCampaignStats(client: LocalLumenSorobanClient): Promise<CampaignStats>;
export function getCampaignStats(
  config: LumenStellarEnv
): Promise<StellarReadResult<TestnetCampaignStats>>;
export async function getCampaignStats(
  input: LocalLumenSorobanClient | LumenStellarEnv
): Promise<CampaignStats | StellarReadResult<TestnetCampaignStats>> {
  if (input instanceof LocalLumenSorobanClient) {
    return input.getCampaignStats();
  }

  return getTestnetCampaignStats(input);
}

export async function isNullifierUsed(
  client: LocalLumenSorobanClient,
  nullifierHash: Hex32
): Promise<boolean> {
  return client.isNullifierUsed(nullifierHash);
}
