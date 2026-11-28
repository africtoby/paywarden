# Rubric map

The official criteria and weights, from [qday.io/builder-challenge](https://qday.io/builder-challenge), each with the evidence in this repository. Everything runs on QDay Aevum testnet (chain 44005). Click any transaction to check it on the [explorer](https://explorer-test.qday.info).

| Criterion | Weight |
| --- | --- |
| [Innovation and originality](#innovation-and-originality-20) | 20 |
| [UX and presentation](#ux-and-presentation-15) | 15 |
| [Technical quality and platform integration](#technical-quality-and-platform-integration-15) | 15 |
| [Real-world utility](#real-world-utility-15) | 15 |
| [Safety, trust and controls](#safety-trust-and-controls-15) | 15 |
| [Clear demo](#clear-demo-10) | 10 |
| [Documentation](#documentation-10) | 10 |

## Innovation and originality (20)

The idea: the worker signs the hours, the AI drafts, you sign the pay. Three people, three signatures, and the contract checks all of them.

- **Worker-signed pay lines.** Each payee signs their own line (payee, amount, memo) with the wallet they confirmed. It is an EIP-712 signature, so it costs no gas. `proposeRun` takes the signatures and the vault checks every one against the confirmed wallet, for ordinary wallets and for smart-contract wallets (ERC-1271). The assistant cannot invent a line, inflate hours or add a payee, because it cannot produce the signature. A signed line can be paid once (`LineAlreadyPaid`). Code: [PayrollVault.sol](../contracts/src/PayrollVault.sol), tests: [WorkerSignatures.t.sol](../contracts/test/WorkerSignatures.t.sol).
- **Wallet-bound invites.** The employer gives the payee's wallet when inviting, so only that wallet can confirm. A second wallet that copied the secret from a pending transaction is refused with `UnexpectedWallet`. See the refusal in the [on-chain proof](../README.md#on-chain-proof).
- **The assistant can only propose, twice over.** A spend policy holds its caps, expiry and off switch. And with ERC-4337, the assistant's key is a session key on the employer's smart account that can sign nothing but `proposeRun` on one vault, until an expiry the EntryPoint enforces. Code: [AgentAccount.sol](../contracts/src/AgentAccount.sol), tests: [AgentAccount.t.sol](../contracts/test/AgentAccount.t.sol), proof: [README](../README.md#on-chain-proof).
- **ERC-8004 style identity** for each confirmed payee and for the assistant.

## UX and presentation (15)

- **[Try it without a wallet](https://paywarden.me/try):** six steps from timesheet to payment, with tricks to try (inflate an amount, add a line nobody signed) and a link to the real on-chain refusal for each error.
- **[Live app](https://paywarden.me):** vault wizard, dashboard, payee invite and confirm, the payee's `/hours` page where a worker signs, runs with eight named checks, review and sign, activity log with explorer links, plain-English errors, light and dark, phone and desktop.
- **[Demo video](https://youtu.be/EGevjYKSC4A)** and a [30-second cut](https://youtube.com/shorts/bFmywFdl-NU).
- A 14-step screenshot walkthrough is in the [README](../README.md#walkthrough).
- Browser end-to-end tests check the pages at desktop and phone size, including a console-error check that found and fixed a real hydration bug.

## Technical quality and platform integration (15)

| What | Evidence |
| --- | --- |
| Contract tests | 123 Foundry tests: unit, fuzz, invariant, ERC-4337, every revert path. 99.7% line coverage of the contract source (100% on the four payroll contracts, 98% on the smart account). |
| Fuzz | 10,000 runs per fuzz test (`contracts/foundry.toml`), on caps, signatures, amounts and the session key's call filter. |
| Invariants | 4 invariants x 512 runs x 64 calls each, including "a signed line is paid at most once". |
| Agent | 41 tests (unit, plus local-chain tests that deploy the real contracts and the canonical EntryPoint v0.7). |
| Web unit | 38 tests (vitest), including that every contract error has a plain-English message. |
| End to end | 17 Playwright tests at two screen sizes, 34 runs. |
| CI | [GitHub Actions](https://github.com/africtoby/paywarden/actions/workflows/ci.yml): contracts, agent, web and end-to-end jobs on every push. |
| Verified contracts | Factory, vault, policy and registry are verified on the Aevum explorer. Each address is listed with the commit it was built from in [Deployments](../README.md#deployments). |
| Platform use | Aevum testnet for all settlement, tUSD8 (6 decimals) as the pay currency, tQDAY (18 decimals) for gas, an ERC-8004 identity registry, a spend policy, and ERC-4337: an employer-owned smart account on the canonical EntryPoint v0.7 with a scoped session key for the assistant ([factory, verified](https://explorer-test.qday.info/address/0x8AD21c204984B915498a98DaBcd7A7AcC03392Bb)). Details in [How it uses the QDay platform](../README.md#how-it-uses-the-qday-platform). |
| Agent design | An LLM reads a free-form timesheet; plain code validates and simulates; a no-LLM mode exists; retries with backoff; waits for receipts. The contract is the final judge. |

## Real-world utility (15)

- Payroll for small teams that pay contractors in stablecoins is a recurring, real job. Today they paste addresses into a multisig by hand or give a bot a hot wallet.
- [Roadmap and business model](ROADMAP.md): who it is for, per-run fee, hosted assistant, pro features, distribution, and the path from testnet to mainnet.
- A [full payday on the current contracts](../README.md#on-chain-proof) from invite to payment to switch-off, and [how it works](HOW-IT-WORKS.md) as a case study.

## Safety, trust and controls (15)

- **[Internal security review](SECURITY-REVIEW.md):** Slither plus a manual checklist review of every contract. 1 medium finding (session-key gas) fixed, tested, redeployed and its refusal recorded on-chain; 8 low or informational findings acknowledged with reasons.

- **[Attack test](ATTACK-TEST.md): 63 of 63 attacks refused, 0 wrong payments, 85 transactions.** 52 refusals are failed transactions on the explorer; 11 were stopped earlier by the agent's own checks. The attacks cover inflated and poisoned amounts, cap breaches, look-alike and unconfirmed payees, replays, the assistant key trying owner powers, a copied invite, expired, paused and switched-off permissions, prompt-injected timesheets, and forged, tampered, reused, empty or missing worker signatures. Run it yourself: `cd agent && npm run attack-test`.
- Named custom errors for every rejection, and an event for every action.
- Caps are checked at proposal and again at payment. A run executes once. Pause freezes everything except cancel and withdraw.
- Every refusal in the proof tables is a real failed transaction, not a screenshot.
- [Security policy](../SECURITY.md) and a documented list of known limits (below).

## Clear demo (10)

[Demo video (2:17)](https://youtu.be/EGevjYKSC4A):

| Time | What it shows |
| --- | --- |
| 0:00 | The problem: giving an assistant the payroll means giving it the money |
| 0:18 | The three gates: the assistant drafts, the contract checks, you sign |
| 0:53 | Setup: vault, limits, the payee confirms from their own wallet |
| 1:07 | A draft and a poisoned timesheet refused by the contract |
| 1:25 | Sign and pay in one transaction |
| 1:54 | Switch the assistant off |

The video was recorded before workers signed their lines. The worker-signature flow is shown in the [try page](https://paywarden.me/try) and in the [on-chain proof](../README.md#on-chain-proof).

## Documentation

- [README](../README.md): the 5-minute tour, architecture and sequence diagrams, deployments with commits, on-chain proof, run-it-yourself steps, environment variables, `cast` examples, known constraints.
- [How it works](HOW-IT-WORKS.md), [Roadmap](ROADMAP.md), [Attack test](ATTACK-TEST.md).
- MIT [LICENSE](../LICENSE) and a [NOTICE](../NOTICE) that credits borrowed code.

## Honest limits

- Testnet only, with test tokens. Internal security review done 28 Nov 2026 ([SECURITY-REVIEW.md](SECURITY-REVIEW.md)): 1 medium finding fixed and redeployed, 8 low or informational acknowledged. No external audit yet; planned before mainnet.
- The demo video predates worker signatures. It shows the earlier deployment; the signed flow is in the proof tables and the try page.
- The worker's signing step needs the worker to open a link and sign once. It adds a step to payday in exchange for removing the assistant's power to invent a line.
- If one transfer in a run fails, the whole run reverts and nobody in it is paid, so one bad payee blocks the run until it is fixed.
- Invite names and salts live in the employer's browser. There is a backup and restore button but no server copy.
- No paymaster: the smart account pays its own gas from its EntryPoint deposit; the session key's gas price and gas limit are capped by the owner. No public bundler is listed for Aevum, so the agent submits `handleOps` itself.
- The identity registry is a reference implementation. We will switch to QDay's if one is published.
- The attack test is our own. It shows the contract refuses what we thought of, not that nothing else exists.
