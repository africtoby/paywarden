# PayWarden

Payroll an AI assistant prepares and only you can sign.

An assistant reads a timesheet and drafts a pay run in tUSD8. A smart contract on QDay Aevum checks the draft against limits you set. Nothing moves until you approve and sign. The assistant can propose a run and nothing else.

Built for the Aevum Builder Challenge #1 (QDay, DoraHacks). All settlement happens on the QDay Aevum testnet (chain 44005).

## How it works

1. **Vault.** An employer creates a vault through the factory and deposits tUSD8.
2. **Confirmation of payee.** The employer invites a payee by a hash of their name and a secret salt. The payee opens an invite link and confirms with their own wallet, which links that wallet to the name and registers it in an ERC-8004 style identity registry. The owner can unlink a wrong wallet with `revokePayee`, which also retires that invite, so a new invite with a fresh salt is needed.
3. **Assistant permissions.** A separate policy contract holds the assistant's address, a per-run cap, a per-person cap, a period cap with its period, an expiry, and a revoke switch.
4. **Propose.** The assistant calls `proposeRun(payeeIds, amounts, memoHash)`. The contract rejects anything outside the policy with a named error.
5. **Review window.** Every run waits for the review window, counted from when it was proposed.
6. **Approve and pay.** The owner approves (or cancels), then calls `executeRun`, which pays everyone in one transaction. A run can execute once, and each proposal has a unique run key, so a retry cannot pay twice.
7. **Pause.** `pause()` freezes proposing, approving and paying. Cancelling and withdrawing still work.

Every rejection is a custom error and every action emits an event. The web app turns both into plain English and links each event to the explorer.

## Repository layout

| Folder | What it is |
| --- | --- |
| `contracts/` | Foundry project: `PayrollVault`, `PayrollVaultFactory`, `AgentSpendPolicy`, `IdentityRegistry` |
| `web/` | Next.js, wagmi, viem, RainbowKit, Tailwind app for the employer and the payee |
| `agent/` | Node and TypeScript service that turns a timesheet into a guarded `proposeRun` |
| `docs/` | Demo script and submission notes |

## Network and deployed contracts

- Network: QDay Aevum Testnet, chain id 44005
- RPC: https://rpc-test.qday.info
- Explorer: https://explorer-test.qday.info
- Gas token: tQDAY (18 decimals). Pay token: tUSD8 (6 decimals).

| Contract | Address |
| --- | --- |
| tUSD8 | [0x456569838f1d43009A91ebA4263147Afd7233483](https://explorer-test.qday.info/address/0x456569838f1d43009A91ebA4263147Afd7233483) |
| PayrollVaultFactory (verified) | [0xC12819acfEA15773cE49c001f6F23842cc4480DA](https://explorer-test.qday.info/address/0xC12819acfEA15773cE49c001f6F23842cc4480DA) |
| IdentityRegistry (verified) | [0x65b0B1df79B5A61021feF2BfA489a49A6b646F85](https://explorer-test.qday.info/address/0x65b0B1df79B5A61021feF2BfA489a49A6b646F85) |

The contracts are compiled for the Shanghai EVM because Aevum does not run the newer `MCOPY` instruction.

## Run it yourself

You need Node 20 or newer, Git, and [Foundry](https://book.getfoundry.sh/getting-started/installation). Use test wallets only.

```bash
git clone https://github.com/africtoby/paywarden.git
cd paywarden
cp .env.example .env     # fill in test keys, never commit this file
```

### Contracts

```bash
cd contracts
forge build
forge test               # unit, fuzz, invariant and every revert path
forge coverage --report summary
```

To deploy your own copy (needs tQDAY in the deployer wallet):

```bash
set -a; source ../.env; set +a
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --legacy
forge verify-contract --chain-id 44005 --verifier blockscout \
  --verifier-url https://explorer-test.qday.info/api <ADDRESS> src/IdentityRegistry.sol:IdentityRegistry
```

Then put the new addresses in `web/src/lib/contracts.ts`.

### Web app

```bash
cd web
npm install
npm run dev              # http://localhost:3000
```

Add the Aevum testnet to your wallet (chain id 44005, RPC above, symbol tQDAY). Get tQDAY and tUSD8 from the QDay faucet. In the app: connect, create a vault, deposit, set the assistant permissions, invite a payee, and open the invite link with a different wallet to confirm.

An optional WalletConnect project id (`NEXT_PUBLIC_WALLETCONNECT_ID` in `web/.env.local`) enables phone wallets. Browser wallets work without it.

### Agent

```bash
cd agent
npm install
cp ../.env.example .env  # set AGENT_PRIVATE_KEY and VAULT_ADDRESS
```

Create `payees.json` with the names and salts you invited (the salt is in the invite link):

```json
[{ "name": "Ada Lovelace", "salt": "0x..." }]
```

The agent address in `AGENT_PRIVATE_KEY` must be the one you set as the assistant in the app, and it needs a little tQDAY for gas.

```bash
npm run propose -- examples/timesheet.txt payees.json
```

A timesheet is lines of `name, hours, rate`, with an optional first line `memo: Week 12`. With `LLM_API_KEY` set, an LLM reads free-form timesheets into JSON. With `USE_LLM_PARSER=false`, or if the LLM call fails, a plain parser is used. Either way, plain code validates the result and simulates the call before sending it. The contract is the final judge: a poisoned timesheet that passes the agent's checks is still refused on-chain.

```bash
npm test                 # includes a local-chain test that deploys the real contracts
```

The integration test needs `anvil` and a built `contracts/out` (`forge build`). It is skipped if `anvil` is missing.

## Safety notes

- The assistant key can only call `proposeRun`. It cannot approve, pay, withdraw or change limits.
- Caps are enforced on-chain at proposal time and again at payment time.
- Payee names and salts stay in the employer's browser; the chain stores only the hash.
- Confirmation of payee is secret-based: whoever submits the name and salt first is bound. A watcher of pending transactions could copy a payee's confirm. Check the wallet shown next to each payee on the run card before you approve. Binding the invite to a wallet is a possible future change.
- Confirmation of payee is secret-based: whoever submits the name and salt first is bound. A watcher of pending transactions could copy a payee's confirm. Check the wallet shown next to each payee on the run card before you approve. Binding the invite to a wallet is a possible future change.
- Test tokens and test wallets only. This code has not been audited.

## Licence

MIT. See [LICENSE](LICENSE). Third-party notices are in [NOTICE](NOTICE).
