import type { Hex32 } from "@lumen-aid/shared";

export const BN254_FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type FieldInput = bigint | number | string;

export function toField(value: FieldInput): bigint {
  let parsed: bigint;

  if (typeof value === "bigint") {
    parsed = value;
  } else if (typeof value === "number") {
    parsed = BigInt(value);
  } else if (value.startsWith("0x")) {
    parsed = BigInt(value);
  } else {
    parsed = BigInt(value);
  }

  const reduced = parsed % BN254_FIELD_MODULUS;
  return reduced >= 0n ? reduced : reduced + BN254_FIELD_MODULUS;
}

export function toFieldString(value: FieldInput): string {
  return toField(value).toString();
}

export function toHex32(value: FieldInput): Hex32 {
  const hex = toField(value).toString(16).padStart(64, "0");
  return `0x${hex}` as Hex32;
}

export function hexToField(value: Hex32): bigint {
  return toField(value);
}

export function assertHex32(value: string): asserts value is Hex32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Expected 32-byte hex value, received ${value}`);
  }
}

export const ZERO_FIELD = toHex32(0);
