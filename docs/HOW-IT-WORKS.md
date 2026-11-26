# How PayWarden works

## The problem

Payroll is boring and repetitive, which makes it a good job for an AI assistant. But handing an assistant the payroll usually means handing it the money too. One bad timesheet, one prompt injection or one wrong wallet address, and the money is gone, with nothing you can undo.

PayWarden splits the job in two. The assistant does the reading and drafting. A contract holds the money and enforces your rules. Only you can sign.

## Three gates

Every pay run passes three gates, in this order:

1. **The assistant drafts.** It reads a timesheet and calls `proposeRun(payeeIds, amounts, memoHash)`. That is the only thing its key can do. It cannot approve, pay, withdraw or change its own limits.
2. **The contract checks.** Before a draft is even stored, the vault and its spend policy check it. If any check fails, the proposal reverts with a named error and nothing is recorded:
   - every payee is confirmed (`PayeeNotConfirmed`)
   - no one is paid more than the per-person cap (`PerPayeeCapExceeded`)
   - the run is under the per-run cap (`PerRunCapExceeded`)
   - the period total stays under the period cap (`PeriodCapExceeded`)
   - the assistant's permission has not expired or been switched off (`PolicyExpired`, `PolicyRevoked`)
   - the vault is not paused
   - the same run has not been proposed before (`DuplicateRun`)
3. **You sign.** The draft waits for a review window. You see each payee, their confirmed wallet, the amount and all seven checks. You approve, then sign and pay. `executeRun` pays everyone in a single transaction and can run only once per run.

The caps are checked again at payment time, so the limits cannot be dodged by waiting.

## The pieces

| Contract | Job |
| --- | --- |
| `PayrollVaultFactory` | Creates one vault per employer. |
| `PayrollVault` | Holds the employer's tUSD8, the payee list and the runs. Owner-only approve, cancel, pay, pause and withdraw. |
| `AgentSpendPolicy` | The assistant's permission: its address, per-run, per-person and period caps, an expiry, and an off switch. |
| `IdentityRegistry` | ERC-8004 style registry. A payee's confirmed wallet is registered here. |

**Confirmation of payee.** You invite someone by a hash of their name and a secret salt. They open the invite link and confirm with their own wallet. From then on, that wallet is the only place their pay can go. A typo in an address, or an attacker's address slipped into a timesheet, has nowhere to land.

Money is tUSD8, a test dollar with 6 decimals, so the app shows it in dollars.

## Case study: a real payday on the testnet

Everything below happened on QDay Aevum testnet (chain 44005) on 25 and 26 November 2026. You can check every step on the explorer.

**The setup.** An employer creates a vault ([0x98F3…5a36](https://explorer-test.qday.info/address/0x98F3C81b754574f08e57bf35bb6BED38e4bD5a36)) from the factory and deposits $1. They give the assistant ([0x0994…9C16](https://explorer-test.qday.info/address/0x0994F68DF677250e8C5C021FCeBb0B4325819C16)) these limits:

| Limit | Value |
| --- | --- |
| Per person, per run | $0.80 |
| Per run | $3 |
| Per period | $10 every 7 days |
| Permission lasts | 90 days |

**The payee.** The employer invites "Ada". Ada opens the link and confirms with her own wallet (0xA90e…fdE6). Her wallet is now linked to her name in the vault and in the identity registry.

**An honest timesheet.** The assistant reads Ada's timesheet and proposes a run of $0.50:

```
Ada: $0.50
Proposed. The owner can review it now.
```

The run card shows all seven checks passing. The employer opens "Review and sign", sees Ada, her confirmed wallet and $0.50, types their name and signs. One transaction pays Ada: [0x5ee35c50…87640](https://explorer-test.qday.info/tx/0x5ee35c50dedf2b4aa8e92dbd6b405efde04146e0f280b52df94cb18afce87640). The explorer shows 0.5 tUSD8 moving from the vault to Ada's wallet.

**A poisoned timesheet.** Next, a timesheet asks for $1.00 for Ada. Imagine an injected line, or a typo. The assistant's own checks could be fooled, but the contract cannot:

```
Refused by the contract: One person's pay ($1) is over the per-person limit ($0.80).
```

The proposal reverts with `PerPayeeCapExceeded`. No run is stored, nothing waits for review, no money moves. There is nothing to undo.

**The off switch.** At the end, the employer switches the assistant off. Its permission shows "Switched off", and any further proposal reverts with `PolicyRevoked` until new permissions are set.

**What it adds up to.** The assistant did the paperwork. The contract refused the bad draft on its own. The money moved only after the owner signed, only to a wallet the payee confirmed, and only once.

## Known limits

- Testnet tokens and test wallets only. Not audited.
- Confirmation of payee is secret-based, so a watcher could copy a payee's first confirm. The run card shows each payee's wallet so the owner can check before approving.
- Invite names and salts live in the employer's browser.
