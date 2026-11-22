import { encodeAbiParameters, keccak256, toHex, type Hex } from "viem";

/** Matches PayrollVault.commitmentOf: keccak256(abi.encode(name, salt)). */
export function payeeId(name: string, salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [name, salt]));
}

export function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b);
}

/** Link the payee opens to confirm. Name and salt travel in the URL fragment, which browsers never send to a server. */
export function inviteLink(origin: string, vault: string, name: string, salt: Hex): string {
  const p = new URLSearchParams({ vault, name, salt });
  return `${origin}/confirm#${p.toString()}`;
}
