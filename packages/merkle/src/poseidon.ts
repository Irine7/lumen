import {
  poseidon2,
  poseidon3,
  poseidon4,
  poseidon8,
  poseidon9,
  poseidon10
} from "poseidon-lite";
import type { Hex32 } from "@lumen-aid/shared";
import { toField, toHex32, type FieldInput } from "./field";

export function poseidonHash(inputs: FieldInput[]): Hex32 {
  const prepared = inputs.map((input) => toField(input).toString());

  switch (prepared.length) {
    case 2:
      return toHex32(poseidon2(prepared));
    case 3:
      return toHex32(poseidon3(prepared));
    case 4:
      return toHex32(poseidon4(prepared));
    case 8:
      return toHex32(poseidon8(prepared));
    case 9:
      return toHex32(poseidon9(prepared));
    case 10:
      return toHex32(poseidon10(prepared));
    default:
      throw new Error(`Unsupported Poseidon arity ${prepared.length}`);
  }
}
