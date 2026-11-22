"use client";

import { useEffect, useState } from "react";
import { WalletButton } from "@/components/wallet-button";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { useAccount } from "wagmi";
import { Seal } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { payrollVaultAbi } from "@/lib/contracts";
import { shortAddress } from "@/lib/format";
import { useTx } from "@/lib/use-tx";

type Invite = { vault: Address; name: string; salt: Hex };

/** The payee opens this page from their invite link and confirms with their own wallet. */
export default function ConfirmPage() {
  const { address, isConnected } = useAccount();
  const tx = useTx();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const vault = p.get("vault");
    const name = p.get("name");
    const salt = p.get("salt");
    const ok = vault && name && salt && isAddress(vault) && isHex(salt, { strict: true }) && salt.length === 66;
    queueMicrotask(() => setInvite(ok ? { vault, name, salt } : null));
  }, []);

  const confirm = async () => {
    if (!invite) return;
    setBusy(true);
    const hash = await tx("Confirm payee", { address: invite.vault, abi: payrollVaultAbi, functionName: "confirmPayee", args: [invite.name, invite.salt] });
    setBusy(false);
    if (hash) setDone(true);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <p className="font-serif text-[22px]">PayWarden</p>

      {invite === undefined && <p className="text-muted-foreground">Loading your invite…</p>}

      {invite === null && (
        <>
          <h1 className="text-[28px]">This invite link looks incomplete.</h1>
          <p className="text-[16px] text-muted-foreground">Ask your employer to send the link again, and open it in full.</p>
        </>
      )}

      {invite && (
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Seal address={done ? address : undefined} size={64} animate className="text-[var(--forest-900)] dark:text-[var(--mist)]" />
            <div>
              <p className="meta text-muted-foreground">Confirmation of payee</p>
              <h1 className="text-[28px] leading-tight">{invite.name}</h1>
            </div>
          </div>

          {done ? (
            <p role="status" className="mt-6 text-[16px]">
              Confirmed. Your wallet {address && shortAddress(address)} is now linked to {invite.name}. You can close this page.
            </p>
          ) : (
            <>
              <p className="mt-6 text-[16px] text-muted-foreground">
                Your employer invited you to be paid in tUSD8. Confirming links the wallet you are connected with to this name. Only that wallet will ever receive your pay.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {isConnected ? (
                  <Button className="rounded-full" disabled={busy} onClick={confirm}>
                    Confirm with this wallet
                  </Button>
                ) : (
                  <WalletButton label="Connect wallet to confirm" />
                )}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
