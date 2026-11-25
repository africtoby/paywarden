# Submission notes (DoraHacks, Aevum Builder Challenge #1)

## One line
Agent-run payroll with on-chain guardrails: an AI assistant drafts pay runs, a contract enforces your limits, and only the employer can sign.

## Description
PayWarden lets a small employer hand the tedious part of payroll to an AI assistant without handing over the money. The assistant reads a timesheet and proposes a run in tUSD8. A separate policy contract checks every proposal against per-run, per-person and per-period caps and an expiry. The employer reviews, approves and signs. A single transaction pays everyone, once.

Payees prove their wallet themselves (confirmation of payee), so nobody is paid at an address they did not vouch for. A wrong wallet can be unlinked by the owner. Every refusal is a named contract error, and the web app explains it in plain English.

## What is built
- Contracts (Foundry): vault, factory, spend policy, ERC-8004 style identity registry. 66 tests, 95% line coverage, fuzz and invariant tests on the caps. Verified on the Aevum explorer.
- Web app: wizard, dashboard, payee invite and confirm, assistant permissions, runs with seven live checks, activity log with explorer links, light and dark themes, responsive.
- Agent: timesheet to JSON (LLM or plain parser), plain-code validation, simulation, retry with backoff, receipt waiting, idempotent proposals. A poisoned timesheet is refused by the contract.

## Links
- Repository: https://github.com/africtoby/paywarden
- Demo video: <add public link>
- Factory: https://explorer-test.qday.info/address/0xC12819acfEA15773cE49c001f6F23842cc4480DA
- IdentityRegistry: https://explorer-test.qday.info/address/0x65b0B1df79B5A61021feF2BfA489a49A6b646F85

## Known limits
- Test tokens and test wallets only; not audited.
- Payee names and salts are kept in the employer's browser; clearing it loses the invite links, not the on-chain confirmations.
- Payee confirmation is secret-based, so a watcher could front-run the first confirm; the run card shows each payee's wallet for the owner to check before approving. Revoking a payee retires the invite.
- ERC-4337 smart-account and paymaster support is not included.
