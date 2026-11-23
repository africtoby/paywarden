# Demo script (about 3 minutes)

Use two browser wallets: the employer and a payee (Ada). Keep the review window short for the recording (set it to 60 seconds in `setReviewWindow`) and say so on screen.

## Shot list

1. **Landing (15s).** "Payroll your AI prepares. Only you can sign." Show the hero demo refusing a bad draft.
2. **Create the vault (20s).** Connect the employer wallet, run the wizard: create vault, deposit tUSD8, set the assistant address and limits. Show the live sentence that describes the permission in plain English.
3. **Invite and confirm a payee (30s).** Payees page: invite "Ada", copy the link. Open it with Ada's wallet, confirm, show the seal drawing in. Mention the warning when the owner wallet opens its own invite.
4. **Assistant drafts a run (30s).** In `agent/`: `npm run propose -- examples/timesheet.txt payees.json`. Show the terminal, then the draft card on the Runs page with the seven checks.
5. **The refusal (30s).** Run a timesheet above the per-person cap. The agent's own checks pass; the contract refuses with a named error. Show the red "Refused by the contract" card and the plain-English message.
6. **Approve and pay (30s).** Approve, wait for the review ring, sign and pay. Show the signature, the payslip fan and the PAID chip. Show Ada's balance and the explorer link.
7. **Close (15s).** Activity log with explorer links, then the assistant page: "switch off" revokes the permission. Pause freezes everything.

## Points to say out loud

- The assistant can only propose. The contract, not the app, enforces the limits.
- The review window counts from when the assistant drafts, so it cannot be shortened by approving late or early.
- A retry never pays twice: each proposal has a unique run key.
- Confirmation of payee: you pay a wallet the payee vouched for, not an address someone pasted.
- Settlement is on QDay Aevum with tUSD8. Contracts are verified on the explorer.
