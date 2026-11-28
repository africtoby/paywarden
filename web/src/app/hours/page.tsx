"use client";

import { useEffect, useState } from "react";
import { isAddress, isHex, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { Seal } from "@/components/seal";
import { WalletButton } from "@/components/wallet-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { addressUrl, aevum } from "@/lib/chain";
import { payrollVaultAbi } from "@/lib/contracts";
import { explainError } from "@/lib/errors";
import { formatMoney, shortAddress } from "@/lib/format";
import { lineAmount, memoHashOf, payLineTypedData, signedLineJson } from "@/lib/pay-line";
import { payeeId } from "@/lib/payee";

type Invite = { vault: Address; name: string; salt: Hex };

/** The worker opens this from their invite link and signs their own hours. No gas, nothing is sent to the chain. */
export default function HoursPage() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [memo, setMemo] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [signed, setSigned] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const vault = p.get("vault");
    const name = p.get("name");
    const salt = p.get("salt");
    const ok = vault && name && salt && isAddress(vault) && isHex(salt, { strict: true }) && salt.length === 66;
    queueMicrotask(() => setInvite(ok ? { vault, name, salt } : null));
  }, []);

  const id = invite ? payeeId(invite.name, invite.salt) : undefined;
  const wallet = useReadContract({
    address: invite?.vault,
    abi: payrollVaultAbi,
    functionName: "payeeWallet",
    args: id ? [id] : undefined,
    query: { enabled: !!invite },
  });
  const confirmedWallet = wallet.data && wallet.data !== zeroAddress ? wallet.data : null;
  const notConfirmed = wallet.isSuccess && !confirmedWallet;
  const wrongWallet = !!confirmedWallet && !!address && confirmedWallet.toLowerCase() !== address.toLowerCase();

  const amount = lineAmount(hours, rate);
  const memoText = memo.trim();
  const ready = !!invite && !!id && amount !== null && amount > 0n && memoText.length > 0 && !wrongWallet && !notConfirmed && isConnected;

  const sign = async () => {
    if (!invite || !id || amount === null) return;
    setError(null);
    try {
      const signature = await signTypedDataAsync(payLineTypedData(invite.vault, aevum.id, id, amount, memoHashOf(memoText)));
      setSigned(signedLineJson(invite.name, memoText, amount, signature));
    } catch (e) {
      setError(explainError(e));
    }
  };

  const copy = async () => {
    if (!signed) return;
    try {
      await navigator.clipboard.writeText(signed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically. Select the text and copy it by hand.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-5 py-12">
      <p className="font-serif text-[22px]">PayWarden</p>

      <section aria-busy={invite === undefined} className="w-full rounded-2xl border border-border bg-[var(--paper-2)] p-6 dark:bg-card md:p-10">
        {invite === undefined && (
          <div className="grid place-items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {invite === null && (
          <div className="grid justify-items-center gap-3 text-center">
            <Seal size={72} className="mx-auto text-[var(--foreground)]" />
            <h1 className="text-[28px]">This invite link looks incomplete.</h1>
            <p className="text-[16px] text-muted-foreground">Ask your employer to send the link again, and open it in full.</p>
          </div>
        )}

        {invite && (
          <div className="grid gap-4">
            <div className="grid justify-items-center gap-2 text-center">
              <Seal address={confirmedWallet ?? undefined} size={72} animate className="text-[var(--forest-900)] dark:text-[var(--mist)]" />
              <p className="meta text-muted-foreground">Sign your hours</p>
              <h1 className="text-[28px] leading-tight">{invite.name}</h1>
              <a href={addressUrl(invite.vault)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                Employer vault {shortAddress(invite.vault)}
              </a>
            </div>

            {signed ? (
              <div role="status" className="grid gap-3">
                <p className="font-serif text-[22px]">Your line is signed</p>
                <p className="text-[16px] text-muted-foreground">
                  Send this to your employer. It proves you agreed to {formatMoney(amount ?? 0n)} for {memoText}. Nothing was sent to the chain and it cost you nothing.
                </p>
                <textarea
                  readOnly
                  value={signed}
                  rows={9}
                  aria-label="Your signed line"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full resize-y rounded-xl border border-border bg-[var(--paper)] p-3 font-mono text-[12px] leading-[1.7] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--forest-900)] dark:bg-[var(--forest-950)] dark:text-[var(--mist)]"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button className="rounded-full" onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setSigned(null)}>
                    Change the hours
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[16px] text-muted-foreground">
                  Tell your employer what you worked. Your wallet signs the amount, so the contract can pay exactly this and nothing else. Signing is free.
                </p>

                {notConfirmed && (
                  <p role="alert" className="rounded-xl border border-[var(--refused)] px-4 py-3 text-[14px] text-[var(--refused)]">
                    This invite is not confirmed yet. Confirm it on your invite page first, then come back here.
                  </p>
                )}
                {isConnected && address && <p className="font-mono text-[12px] text-muted-foreground">Connected as {shortAddress(address)}</p>}
                {wrongWallet && (
                  <p role="alert" className="rounded-xl border border-[var(--refused)] px-4 py-3 text-[14px] text-[var(--refused)]">
                    You are connected with a different wallet. Switch to {shortAddress(confirmedWallet!)}, the one you confirmed, to sign.
                  </p>
                )}

                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (ready) void sign();
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="memo">Pay period</Label>
                    <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Week 48" maxLength={200} autoComplete="off" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="hours">Hours</Label>
                      <Input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="40" autoComplete="off" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="rate">Rate per hour ($)</Label>
                      <Input id="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="15.00" autoComplete="off" />
                    </div>
                  </div>
                  <p className="tnum font-serif text-[22px]" aria-live="polite">
                    {amount !== null && amount > 0n ? `You are signing for ${formatMoney(amount)}` : "Enter your hours and rate"}
                  </p>
                  {error && (
                    <p role="alert" className="text-[14px] text-[var(--refused)]">
                      {error}
                    </p>
                  )}
                  {isConnected ? (
                    <Button type="submit" className="w-fit rounded-full" disabled={!ready || isPending}>
                      {isPending ? "Check your wallet" : "Sign my hours"}
                    </Button>
                  ) : (
                    <WalletButton label="Connect wallet to sign" />
                  )}
                </form>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
