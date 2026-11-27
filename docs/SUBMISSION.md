# Submission notes (DoraHacks, Aevum Builder Challenge #1)

## One line
Agent-run payroll with on-chain guardrails: an AI assistant drafts pay runs, a contract enforces your limits, and only the employer can sign.

## Description
PayWarden lets a small employer hand the tedious part of payroll to an AI assistant without handing over the money. The assistant reads a timesheet and proposes a run in tUSD8. A separate policy contract checks every proposal against per-run, per-person and per-period caps and an expiry. The employer reviews, approves and signs. A single transaction pays everyone, once.

Payees prove their wallet themselves (confirmation of payee), and invites can be bound to that wallet, so nobody is paid at an address they did not vouch for and a copied invite is useless. A wrong wallet can be unlinked by the owner. Every refusal is a named contract error, and the web app explains it in plain English.

## What is built
- Contracts (Foundry): vault, factory, spend policy, ERC-8004 style identity registry. 75 tests, 95.7% line coverage (100% on every contract source file), CI on every push, fuzz and invariant tests on the caps. Verified on the Aevum explorer.
- Web app: wizard, dashboard, wallet-bound payee invites with confirm page and invite backup, assistant permissions, runs with seven live checks, a review-and-sign step before paying, activity log with explorer links, amounts shown in dollars, light and dark themes, responsive.
- Agent: timesheet to JSON (LLM or plain parser), plain-code validation, simulation, retry with backoff, receipt waiting, idempotent proposals. A poisoned timesheet is refused by the contract.

## Links
- Repository: https://github.com/africtoby/paywarden
- Demo video (2:17): https://youtu.be/EGevjYKSC4A
- 30-second cut: https://youtube.com/shorts/bFmywFdl-NU
- How it works, with a real testnet run: https://github.com/africtoby/paywarden/blob/main/docs/HOW-IT-WORKS.md
- Live app: https://paywarden.me
- Roadmap and business model: https://github.com/africtoby/paywarden/blob/main/docs/ROADMAP.md
- On-chain proof (15 transactions, incl. 3 refusals): https://github.com/africtoby/paywarden#on-chain-proof
- Paid run on the explorer: https://explorer-test.qday.info/tx/0x9a83f5f89a9b6696565c3407ff7577fb2d528e8647efd388db13e54a0b17cf29
- Factory: https://explorer-test.qday.info/address/0x624C478779CCc80299bAa2A22833bab88e18198E
- IdentityRegistry: https://explorer-test.qday.info/address/0x65b0B1df79B5A61021feF2BfA489a49A6b646F85

## Known limits
- Test tokens and test wallets only; not audited.
- Payee names and salts are kept in the employer's browser; clearing it loses the invite links, not the on-chain confirmations.
- Invites can be bound to the payee's wallet, so a copied secret cannot be used by anyone else (proven on-chain: UnexpectedWallet). An invite without a wallet stays open to whoever confirms first. Revoking a payee retires the invite.
- If one transfer in a run fails, the whole run reverts (no partial payroll).
- Invite links live in the employer's browser; the Payees page has backup and restore.
- ERC-4337 smart-account and paymaster support is not included.
