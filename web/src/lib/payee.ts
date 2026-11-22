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

/** Names typed when inviting. They live only in this browser; the chain stores just the hash. */
export function payeeNames(vault: string): Map<string, string> {
  try {
    const list = JSON.parse(localStorage.getItem(`paywarden:invites:${vault.toLowerCase()}`) ?? "[]") as { id: string; name: string }[];
    return new Map(list.map((i) => [i.id, i.name]));
  } catch {
    return new Map();
  }
}
