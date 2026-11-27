"use client";

import { useEffect, useState } from "react";
import { WalletButton } from "@/components/wallet-button";
import { isAddress, isHex, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { Seal } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollVaultAbi } from "@/lib/contracts";
import { addressUrl, txUrl } from "@/lib/chain";
import { shortAddress, shortHash } from "@/lib/format";
import { payeeId } from "@/lib/payee";
import { useTx } from "@/lib/use-tx";

type Invite = { vault: Address; name: string; salt: Hex };

/** The payee opens this page from their invite link and confirms with their own wallet. */
export default function ConfirmPage() {
  const { address, isConnected } = useAccount();
  const tx = useTx();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [done, setDone] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const vault = p.get("vault");
    const name = p.get("name");
    const salt = p.get("salt");
    const ok = vault && name && salt && isAddress(vault) && isHex(salt, { strict: true }) && salt.length === 66;
    queueMicrotask(() => setInvite(ok ? { vault, name, salt } : null));
  }, []);

  const owner = useReadContract({ address: invite?.vault, abi: payrollVaultAbi, functionName: "owner", query: { enabled: !!invite } });
  const isOwner = !!address && !!owner.data && owner.data.toLowerCase() === address.toLowerCase();
  // When the employer bound the invite to a wallet, only that wallet can confirm it.
  const expected = useReadContract({
    address: invite?.vault,
    abi: payrollVaultAbi,
    functionName: "expectedWallet",
    args: invite ? [payeeId(invite.name, invite.salt)] : undefined,
    query: { enabled: !!invite },
  });
  const boundTo = expected.data && expected.data !== zeroAddress ? expected.data : null;
  const wrongWallet = !!boundTo && !!address && boundTo.toLowerCase() !== address.toLowerCase();

  const confirm = async () => {
    if (!invite) return;
    setBusy(true);
    const hash = await tx("Confirm payee", { address: invite.vault, abi: payrollVaultAbi, functionName: "confirmPayee", args: [invite.name, invite.salt] });
    setBusy(false);
    if (hash) setDone(hash);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-5 py-12">
      <p className="font-serif text-[22px]">PayWarden</p>

      <section aria-busy={invite === undefined} className="w-full rounded-2xl border border-border bg-[var(--paper-2)] p-6 text-center dark:bg-card md:p-10">
        {invite === undefined && (
          <div className="grid place-items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-48 rounded-full" />
          </div>
        )}

        {invite === null && (
          <div className="grid gap-3">
            <Seal size={72} className="mx-auto text-[var(--foreground)]" />
            <h1 className="text-[28px]">This invite link looks incomplete.</h1>
            <p className="text-[16px] text-muted-foreground">Ask your employer to send the link again, and open it in full.</p>
          </div>
        )}

        {invite && (
          <div className="grid justify-items-center gap-4">
            <Seal key={done ? "done" : "open"} address={done ? address : undefined} size={96} animate className="text-[var(--forest-900)] dark:text-[var(--mist)]" />
            <p className="meta text-muted-foreground">Confirmation of payee</p>
            <h1 className="text-[28px] leading-tight">{invite.name}</h1>
            <a href={addressUrl(invite.vault)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
              Invited by vault {shortAddress(invite.vault)}
            </a>

            {done ? (
              <div role="status" className="grid justify-items-center gap-2">
                <p className="font-serif text-[22px]">You&apos;re a confirmed payee</p>
                <p className="text-[16px] text-muted-foreground">
                  Your wallet {address && shortAddress(address)} is now linked to {invite.name}. You can close this page.
                </p>
                <a href={txUrl(done)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                  {shortHash(done)}
                </a>
              </div>
            ) : (
              <>
                <p className="max-w-sm text-[16px] text-muted-foreground">
                  Your employer invited you to be paid in tUSD8. Confirming links the wallet you are connected with to this name. Only that wallet will ever receive your pay.
                </p>
                <p className="max-w-sm text-[14px] text-muted-foreground">Confirming is one transaction and needs a little tQDAY in this wallet for the network fee.</p>
                {isConnected && address && (
                  <p className="font-mono text-[12px] text-muted-foreground">Connected as {shortAddress(address)}</p>
                )}
                {boundTo && (
                  <p className="max-w-sm text-[14px] text-muted-foreground">
                    This invite can only be accepted by wallet <span className="font-mono">{shortAddress(boundTo)}</span>.
                  </p>
                )}
                {wrongWallet && !isOwner && (
                  <p role="alert" className="max-w-sm rounded-xl border border-[var(--refused)] px-4 py-3 text-[14px] text-[var(--refused)]">
                    You are connected with a different wallet. Switch to {shortAddress(boundTo!)} to confirm.
                  </p>
                )}
                {isOwner && (
                  <p role="alert" className="max-w-sm rounded-xl border border-[var(--refused)] px-4 py-3 text-[14px] text-[var(--refused)]">
                    This wallet owns the vault. Switch to the payee&apos;s own wallet before confirming, or you would be paying yourself.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {isConnected ? (
                    <Button className="rounded-full" disabled={busy || isOwner || wrongWallet} onClick={confirm}>
                      Confirm with this wallet
                    </Button>
                  ) : (
                    <WalletButton label="Connect wallet to confirm" />
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
