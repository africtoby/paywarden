# How PayWarden works

## The problem

Payroll is boring and repetitive, which makes it a good job for an AI assistant. But handing an assistant the payroll usually means handing it the money too. One bad timesheet, one prompt injection or one wrong wallet address, and the money is gone, with nothing you can undo.

PayWarden splits the job in two. The assistant does the reading and drafting. A contract holds the money and enforces your rules. Only you can sign.

## Three gates

Every pay run starts with a signature from the worker, then passes three gates, in this order:

0. **The worker signs.** Each payee signs their own pay line (payee, amount, memo) with the wallet they confirmed. It is an EIP-712 signature, so it costs no gas. Without it, the contract will not accept the line.

1. **The assistant drafts.** It reads the signed timesheet and calls `proposeRun(payeeIds, amounts, memoHash, signatures)`. That is the only thing its key can do. It cannot approve, pay, withdraw or change its own limits.
2. **The contract checks.** Before a draft is even stored, the vault and its spend policy check it. If any check fails, the proposal reverts with a named error and nothing is recorded:
   - every payee is confirmed (`PayeeNotConfirmed`)
   - every line is signed by that payee's confirmed wallet (`InvalidWorkerSignature`), and has not been paid before (`LineAlreadyPaid`)
   - no one is paid more than the per-person cap (`PerPayeeCapExceeded`)
   - the run is under the per-run cap (`PerRunCapExceeded`)
   - the period total stays under the period cap (`PeriodCapExceeded`)
   - the assistant's permission has not expired or been switched off (`PolicyExpired`, `PolicyRevoked`)
   - the vault is not paused
   - the same run has not been proposed before (`DuplicateRun`)
3. **You sign.** The draft waits for a review window. You see each payee, their confirmed wallet, the amount and all eight checks. You approve, then sign and pay. `executeRun` pays everyone in a single transaction and can run only once per run.

The caps are checked again at payment time, so the limits cannot be dodged by waiting.

## The pieces

| Contract | Job |
| --- | --- |
| `PayrollVaultFactory` | Creates one vault per employer. |
| `PayrollVault` | Holds the employer's tUSD8, the payee list and the runs. Owner-only approve, cancel, pay, pause and withdraw. |
| `AgentSpendPolicy` | The assistant's permission: its address, per-run, per-person and period caps, an expiry, and an off switch. |
| `IdentityRegistry` | ERC-8004 style registry. A payee's confirmed wallet is registered here. |
| `AgentAccount` (optional) | ERC-4337 smart account (EntryPoint v0.7) owned by the employer. Set as the assistant, it lets the AI's key act only as a session key: it can sign `proposeRun` on one vault until an expiry, and nothing else. Created by `AgentAccountFactory`. |

**Confirmation of payee.** You invite someone by a hash of their name and a secret salt. You also give their wallet address, so only that wallet can accept the invite, even if someone copies the secret. They open the invite link and confirm from that wallet. From then on, that wallet is the only place their pay can go. A typo in an address, or an attacker's address slipped into a timesheet, has nowhere to land.

**Worker-signed pay lines.** Once confirmed, the payee signs what they are owed: a typed message with their payee id, the amount and the memo (the period). The vault checks the signature against the confirmed wallet, for ordinary wallets and smart-contract wallets alike. So the assistant cannot invent a line, inflate hours or add a payee, and a signed line is paid once.

**A session key instead of a wallet (ERC-4337).** The assistant can also work through the employer's smart account. Its key then signs a user operation rather than a transaction, and the account accepts that signature for exactly one call: `proposeRun` on the employer's vault, with no value, before the expiry. Approving, paying, withdrawing or changing its own permissions all fail validation at the EntryPoint (`AA24`), and after the expiry the EntryPoint itself refuses (`AA22`). Gas is paid from the account's EntryPoint deposit, so the assistant's key holds no money and no gas at all. The spend policy's caps still apply on top.

Money is tUSD8, a test dollar with 6 decimals, so the app shows it in dollars.

## Case study: a real payday on the testnet

Everything below happened on QDay Aevum testnet (chain 44005) on 28 November 2026, on the current contracts. You can check every step on the explorer. The demo video shows an earlier payday on the previous deployment, before workers signed their lines.

**The setup.** An employer creates a vault ([0xDa9E…3273](https://explorer-test.qday.info/address/0xDa9E2AF624d26C0015E3e3a62BF2eEdD4bf13273)) from the factory ([0x88a51701…7f26](https://explorer-test.qday.info/tx/0x88a51701ca116141dac8444c70a97d6843586f8f3aee7ba57546ca2101f97f26)) and deposits $0.50 ([0x785b5879…f218](https://explorer-test.qday.info/tx/0x785b5879f823fce927232e18d46e95f44990add328883903e9700452ebbaf218)). They give the assistant ([0x0994…9C16](https://explorer-test.qday.info/address/0x0994F68DF677250e8C5C021FCeBb0B4325819C16)) these limits ([0xeb6e1ce3…0fce](https://explorer-test.qday.info/tx/0xeb6e1ce30d9f1979f0d151bd216488acd01dcba0fcf212ef8ffa02fc4ad00fce)):

| Limit | Value |
| --- | --- |
| Per person, per run | $0.80 |
| Per run | $3 |
| Per period | $10 every 7 days |
| Permission lasts | 90 days |

**The payee.** The employer invites "Ada" and gives her wallet address ([0x2ca27d0c…d961](https://explorer-test.qday.info/tx/0x2ca27d0c719982a9cd31bb3e45c5edb8b71fdd747f36eaf095c140392f3fd961)). A second wallet then copies Ada's secret and tries to confirm first. That is what a watcher of pending transactions could do. The contract refuses it with `UnexpectedWallet` ([0x9055f17d…f3df](https://explorer-test.qday.info/tx/0x9055f17d6b11d31a859ad4ebfe72253597a6c9615861d17d7614181effa1f3df)). Ada confirms from her own wallet ([0xa9dbb3b1…9689](https://explorer-test.qday.info/tx/0xa9dbb3b183f8d94f4b266d6ffdbbd7fd29ed352d55c3bc68c60db674b1779689)), and her wallet is now linked to her name in the vault and in the identity registry.

**The worker signs.** Ada opens the invite link on the app's hours page, enters her hours and rate, and signs her pay line: her payee id, the amount ($0.50) and the memo. It is an EIP-712 signature made in her wallet. It costs no gas, so there is no transaction for it. The line now carries something the assistant cannot make.

**An honest, signed timesheet.** The assistant reads the signed timesheet, checks Ada's signature off-chain, and proposes a run of $0.50:

```
Ada: $0.50 (signed by Ada)
Proposed. The owner can review it now.
```

([0x94b0a801…6c30](https://explorer-test.qday.info/tx/0x94b0a80127db9bcd7c5d4ace7f8f8346ee0563d636d38709f3f72e6ca6886c30))

The contract checked Ada's signature against the wallet she confirmed, and the run card shows all eight checks passing. The employer opens "Review and sign", sees Ada, her confirmed wallet and $0.50, types their name and signs. After the owner approves ([0xdaba5573…20fd](https://explorer-test.qday.info/tx/0xdaba557382db29595fe59762e4548ad41864c371c63bdf4f43edbf6c418a20fd)) and the review window passes, one transaction pays Ada: [0x3f9c88f1…0318](https://explorer-test.qday.info/tx/0x3f9c88f12399a2da3a890525847fc136db45160816e57036bda76527065a0318). The explorer shows 0.5 tUSD8 moving from the vault to Ada's wallet.

**Lines nobody signed.** Imagine a poisoned timesheet or an injected line. The assistant's own checks could be fooled, but the contract cannot. A line signed by the wrong key reverts with `InvalidWorkerSignature` ([0xfa525d12…a47a](https://explorer-test.qday.info/tx/0xfa525d12ef1c1b965b5d14a25e3555b32b3d6531cbcaa3d71a23b55d2347a47a)), and so does a line with no signature ([0x65321342…870f](https://explorer-test.qday.info/tx/0x6532134251d6f0dfc89323f5b352b95cca6f2e755a5ed11b899f73d78faa870f)). No run is stored, nothing waits for review, no money moves. The agent simulates first, so it never sends these. To leave proof on-chain, the same drafts were sent anyway.

**Paid once.** The same signed line in a second run reverts with `LineAlreadyPaid` ([0x0c3c6baa…bcac](https://explorer-test.qday.info/tx/0x0c3c6baa99ee3964f140650c86b12b7ac60fe60d95953fafd87559939f1bbcac)). Ada's signature cannot be replayed to pay her twice for the same period.

**The off switch.** At the end, the employer switches the assistant off ([0xe495834f…db4f](https://explorer-test.qday.info/tx/0xe495834f0bc53127fdfd50c84ca2d258131a19738a72f572986708f82d05db4f)). The next draft reverts with `PolicyRevoked` ([0xf2ee48f0…3c41](https://explorer-test.qday.info/tx/0xf2ee48f0fa621f815a210f44f867fbb1fe66cf23d74a6aa606166af007d83c41)) until new permissions are set.

**What it adds up to.** The worker signed the hours, the assistant did the paperwork, and the owner signed the pay. The contract refused the unsigned and wrongly signed lines, the copied confirm and the replay on its own. The money moved only after the owner signed, only to the wallet Ada confirmed, and only once.

## Known limits

- Testnet tokens and test wallets only. Internal security review done 28 Nov 2026 ([SECURITY-REVIEW.md](SECURITY-REVIEW.md)): 1 medium finding fixed and redeployed, 8 low or informational acknowledged. No external audit yet; planned before mainnet.
- The app always binds an invite to the payee's wallet. The contract also allows an open invite (`address(0)`) for direct integrations, which anyone holding the secret could confirm first.
- If one transfer in a run fails, the whole run reverts: no partial payroll, but one bad payee blocks the run.
- Invite names and salts live in the employer's browser.
