# Who it's for, how it makes money, and what comes next

## Who it's for

**Small teams that pay people in stablecoins**: remote startups, agencies, and DAOs paying 5 to 50 contractors, every week or month.

Today they either:
- paste addresses into a multisig by hand every payday (slow, and one typo sends money to the wrong place), or
- give a script or bot a hot wallet (fast, but one bug or one poisoned input can drain it).

PayWarden sits between the two. The assistant does the tedious part: reading timesheets, matching names, adding it up. The contract holds the money and the rules, and the owner keeps the final signature.

**Why now:** AI assistants are starting to act on money. "Agentic payments" need guardrails that live outside the agent: limits the agent cannot change, and a human who signs. PayWarden is that pattern applied to the most repetitive payment there is.

## How it fits into a real payday

1. Contractors submit hours the way they already do (a sheet, a form, an email). The assistant reads them.
2. The assistant drafts the run. The contract checks it against the caps; anything outside them is refused before a person ever sees it.
3. The owner gets one card to review: who, which confirmed wallet, how much, and seven green checks. They sign once and everyone is paid in one transaction.
4. Every step is an on-chain event, so the activity log doubles as an audit trail for accounting.

## Business model

| Stream | How it works |
| --- | --- |
| Per-run fee | A small fee on each executed run (for example 0.1%, capped per run), taken by the vault at payment time. It's transparent and on-chain, and the owner sees it before signing. |
| Hosted assistant | A subscription for teams who don't want to run the agent themselves. We host it, connect it to their timesheet source, and handle LLM costs. |
| Pro features | Recurring paydays, CSV and accounting exports, several approvers, and role-based access for finance teams. |

The core contracts stay open source. The business is in the hosting, the integrations and the convenience.

## Distribution

- **QDay ecosystem first**: be the payroll primitive other Aevum apps and DAOs plug into. The vault and policy are just contracts, so any front end can use them.
- **Contractor platforms and agencies**: one agency onboarding brings dozens of payees, and each payee who confirms sees the product.
- **Open source as marketing**: a clean, tested, verified reference for "AI that can propose but not pay".

## Roadmap

| When | What |
| --- | --- |
| **Done (hackathon)** | Vault, factory, spend policy and identity registry on Aevum testnet, verified. Wallet-bound invites against front-running. Re-proposing a cancelled run. Agent with an LLM or plain parser, retries and idempotency. Web app with review-and-sign, an activity log and a backup of invites. CI on every push. |
| **Dec 2026 to Jan 2027** | Recurring paydays (the agent drafts on a schedule; the owner still signs). CSV and accounting export. Several approvers (2-of-3 sign-off). Hosted live demo. |
| **Feb 2027: QDay mainnet** | External security review. Mainnet deployment with real stablecoins. Use QDay's own ERC-8004 identity registry if they publish one. |
| **Q2 2027** | ERC-4337 smart accounts: the assistant gets a scoped session key with the same caps, and a paymaster sponsors gas so payees never need gas to confirm. The `AgentSpendPolicy` already works like a scoped session key (one key, hard caps, expiry, instant revoke); 4337 makes it native. |
| **Q3 2027** | Integrations: timesheet tools (Harvest, Toggl, Google Sheets), Slack approval notifications, and multi-currency stablecoin support. |

## Known limits today

- Testnet only, not audited.
- If one transfer in a run fails, the whole run reverts and nobody is paid. That's safe (no partial payroll), but one bad payee blocks the run until it's fixed.
- Invite names and salts live in the employer's browser. There is now a backup and restore button, but no server copy.
- The app always binds invites to the payee's wallet. Direct contract callers can still make an open invite (`address(0)`), which anyone holding the secret could confirm first.
