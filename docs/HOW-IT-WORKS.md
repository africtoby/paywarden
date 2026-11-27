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

**Confirmation of payee.** You invite someone by a hash of their name and a secret salt. You also give their wallet address, so only that wallet can accept the invite, even if someone copies the secret. They open the invite link and confirm from that wallet. From then on, that wallet is the only place their pay can go. A typo in an address, or an attacker's address slipped into a timesheet, has nowhere to land.

Money is tUSD8, a test dollar with 6 decimals, so the app shows it in dollars.

## Case study: a real payday on the testnet

Everything below happened on QDay Aevum testnet (chain 44005) on 27 November 2026, on the current contracts. You can check every step on the explorer. The demo video shows the same payday on the previous deployment.

**The setup.** An employer creates a vault ([0x1712…3C76](https://explorer-test.qday.info/address/0x171290CcBA179A9B8f89ff408134F09F33Da3C76)) from the factory and deposits $1. They give the assistant ([0x0994…9C16](https://explorer-test.qday.info/address/0x0994F68DF677250e8C5C021FCeBb0B4325819C16)) these limits:

| Limit | Value |
| --- | --- |
| Per person, per run | $0.80 |
| Per run | $3 |
| Per period | $10 every 7 days |
| Permission lasts | 90 days |

**The payee.** The employer invites "Ada" and gives her wallet address (0x309b…8E60). A second wallet then copies Ada's secret and tries to confirm first. That is what a watcher of pending transactions could do. The contract refuses it with `UnexpectedWallet` ([0x1fb53adb…2e33](https://explorer-test.qday.info/tx/0x1fb53adbd771bb8c768daaf4b206790c4b3e4fcd35e11d6e3c41af1e5b092e33)). Ada confirms from her own wallet ([0x3e59c667…eab](https://explorer-test.qday.info/tx/0x3e59c6677d880ebfae90425aa0a0309dfe359552cce25601dfa457ac88d35eab)), and her wallet is now linked to her name in the vault and in the identity registry.

**An honest timesheet.** The assistant reads Ada's timesheet and proposes a run of $0.50:

```
Ada: $0.50
Proposed. The owner can review it now.
```

([0xe9ce3f95…eaf8](https://explorer-test.qday.info/tx/0xe9ce3f9509fac596de17fd3e7ce331adf8357b9e366bee6a7df8e6e94befeaf8))

The run card shows all seven checks passing. The employer opens "Review and sign", sees Ada, her confirmed wallet and $0.50, types their name and signs. After the owner approves and the review window passes, one transaction pays Ada: [0x9a83f5f8…cf29](https://explorer-test.qday.info/tx/0x9a83f5f89a9b6696565c3407ff7577fb2d528e8647efd388db13e54a0b17cf29). The explorer shows 0.5 tUSD8 moving from the vault to Ada's wallet.

**A poisoned timesheet.** Next, a timesheet asks for $1.00 for Ada. Imagine an injected line, or a typo. The assistant's own checks could be fooled, but the contract cannot:

```
Refused by the contract: One person's pay ($1) is over the per-person limit ($0.80).
```

The agent simulates first, so it never sends this. To leave proof on-chain, the same draft was sent anyway, and it reverts with `PerPayeeCapExceeded` ([0x57676985…851f](https://explorer-test.qday.info/tx/0x576769855e47e51f2d4a73fea47b6d7c860bc8c3aa98176a8162edd2870b851f)). No run is stored, nothing waits for review, no money moves. There is nothing to undo.

**A cancel and a second try.** The assistant drafts a $0.25 run; the owner cancels it. The same run can be drafted again ([0x2351d7d5…edd5](https://explorer-test.qday.info/tx/0x2351d7d595f7be22654695ef205aa59ddfb8e799fc9bc601513d472bb3efedd5)) and goes through review again. Only a paid run can never be drafted twice.

**The off switch.** At the end, the employer switches the assistant off ([0xaebaad40…f795](https://explorer-test.qday.info/tx/0xaebaad407747cd2e050ef7f93dbbff6a0a1eee18082afc27f2ccad28b58bf795)). The next draft reverts with `PolicyRevoked` ([0xf877f0f0…2def](https://explorer-test.qday.info/tx/0xf877f0f02abed8ef5eea320493502449e2c30d1cd4bfd655dfc4990e01102def)) until new permissions are set.

**What it adds up to.** The assistant did the paperwork. The contract refused the bad draft and the copied confirm on its own. The money moved only after the owner signed, only to the wallet Ada confirmed, and only once.

## Known limits

- Testnet tokens and test wallets only. Not audited.
- An invite without a wallet is open to whoever confirms first with the secret. Give the payee's wallet when inviting (the app recommends it) to close this.
- If one transfer in a run fails, the whole run reverts: no partial payroll, but one bad payee blocks the run.
- Invite names and salts live in the employer's browser.
