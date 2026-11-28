<div align="center">

<img src="docs/images/banner.png" alt="PayWarden: AI drafts payroll. Only you sign." width="100%">

<br>

[![CI](https://github.com/africtoby/paywarden/actions/workflows/ci.yml/badge.svg)](https://github.com/africtoby/paywarden/actions/workflows/ci.yml)
[![Live app](https://img.shields.io/badge/live-paywarden.me-CDB97E?style=flat&labelColor=0E3B2B)](https://paywarden.me)
[![Demo video](https://img.shields.io/badge/demo-watch_on_YouTube-FF0000?style=flat&logo=youtube&logoColor=white)](https://youtu.be/EGevjYKSC4A)
[![Aevum testnet](https://img.shields.io/badge/QDay_Aevum-chain_44005-1F6B47?style=flat)](https://explorer-test.qday.info)
[![License: MIT](https://img.shields.io/badge/license-MIT-8DA597?style=flat)](LICENSE)

![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat&logo=solidity&logoColor=white)
![Foundry](https://img.shields.io/badge/Foundry-75_tests-E35F23?style=flat)
![Coverage](https://img.shields.io/badge/coverage-95.7%25-1F6B47?style=flat)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-agent_+_web-3178C6?style=flat&logo=typescript&logoColor=white)
![viem](https://img.shields.io/badge/wagmi_+_viem-RainbowKit-7B3FE4?style=flat)

**Payroll an AI assistant prepares and only you can sign.**

An assistant reads a timesheet and drafts a pay run in tUSD8. A smart contract on QDay Aevum checks it against limits you set.<br>Nothing moves until you approve and sign. The assistant can propose a run and nothing else.

[**Live app**](https://paywarden.me) · [**Demo video**](https://youtu.be/EGevjYKSC4A) · [**30-second cut**](https://youtube.com/shorts/bFmywFdl-NU) · [**How it works**](docs/HOW-IT-WORKS.md) · [**Roadmap**](docs/ROADMAP.md)

<sub>Built for the Aevum Builder Challenge #1 (QDay × DoraHacks). All settlement happens on the QDay Aevum testnet.</sub>

</div>

---

> [!TIP]
> **The 5-minute tour**
> 1. [Try it without a wallet](https://paywarden.me/try): run a payday in five steps, try to trick the assistant, and watch the contract's checks refuse it.
> 2. Watch the [2-minute demo](https://youtu.be/EGevjYKSC4A).
> 3. Read the [attack test](docs/ATTACK-TEST.md): 63 of 63 attacks refused on Aevum testnet, 0 wrong payments, every refusal an on-chain transaction.
> 4. See every address and the commit it was built from in [Deployments](#deployments), and a full payday in [On-chain proof](#on-chain-proof).
> 5. Use the real app at [paywarden.me](https://paywarden.me) (free test tokens from the [QDay faucet](https://faucet.qday.info/en)). The code as submitted is tagged [`submission-v1`](https://github.com/africtoby/paywarden/tree/submission-v1).

## Watch it

https://github.com/user-attachments/assets/7ecce811-b1b1-4901-b68a-cffea238a4d8

<table>
  <tr>
    <td width="50%" align="center">
      <a href="https://youtu.be/EGevjYKSC4A"><img src="docs/images/demo-preview.gif" alt="PayWarden demo preview: a poisoned timesheet refused by the contract" width="100%"></a>
      <br><b>Full demo (2:17)</b><br><sub>Setup, a poisoned timesheet refused on-chain, sign and pay, switch-off</sub>
    </td>
    <td width="50%" align="center">
      <a href="https://youtube.com/shorts/bFmywFdl-NU"><img src="docs/images/short-preview.gif" alt="PayWarden 30-second cut preview" width="100%"></a>
      <br><b>30-second cut</b><br><sub>The idea in half a minute</sub>
    </td>
  </tr>
</table>

## The problem

Payroll is repetitive, which makes it a good job for an AI assistant. But giving an assistant the payroll usually means giving it the money. One poisoned timesheet, one prompt injection or one wrong wallet address, and the money is gone for good.

PayWarden splits the job. The assistant reads and drafts. A contract holds the money and enforces your limits. Only you can sign.

## Walkthrough

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/01-landing.jpg" alt="Landing page" width="100%"><br><b>Landing page</b><br><sub>The promise and a live demo of a run being checked.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/02-create-vault.jpg" alt="1 · Create a vault" width="100%"><br><b>1 · Create a vault</b><br><sub>Pick a review window. The factory deploys your vault and spend policy.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/03-limits.jpg" alt="2 · Set the assistant's limits" width="100%"><br><b>2 · Set the assistant's limits</b><br><sub>Per run, per person, per period and an expiry, enforced on-chain.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/04-vault-open.jpg" alt="3 · Vault funded" width="100%"><br><b>3 · Vault funded</b><br><sub>Balance, the assistant's allowance and your controls in one place.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/05-invite.jpg" alt="4 · Invite a payee" width="100%"><br><b>4 · Invite a payee</b><br><sub>By name, with their wallet, so only they can accept the invite.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/06-confirmed.jpg" alt="5 · Payee confirms" width="100%"><br><b>5 · Payee confirms</b><br><sub>Ada confirms from her own wallet. Her pay can only go there.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/07-drafts.jpg" alt="6 · The assistant drafts" width="100%"><br><b>6 · The assistant drafts</b><br><sub>The agent reads the timesheet and proposes a $0.50 run.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/08-checks.jpg" alt="7 · Seven checks pass" width="100%"><br><b>7 · Seven checks pass</b><br><sub>The run card shows every rule the contract enforces.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/09-refused.jpg" alt="8 · A poisoned timesheet is refused" width="100%"><br><b>8 · A poisoned timesheet is refused</b><br><sub>$1 against a $0.80 limit: the contract says no.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/10-review-sign.jpg" alt="9 · Review and sign" width="100%"><br><b>9 · Review and sign</b><br><sub>See who gets what, type your name, sign in your wallet.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/11-paid.jpg" alt="10 · Paid, once" width="100%"><br><b>10 · Paid, once</b><br><sub>Drafted → Signed → Paid, with your signature on the run.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/12-explorer.jpg" alt="11 · Verifiable on the explorer" width="100%"><br><b>11 · Verifiable on the explorer</b><br><sub>One transaction, Success, $0.50 to Ada's wallet.</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/images/13-activity.jpg" alt="12 · Every action on the record" width="100%"><br><b>12 · Every action on the record</b><br><sub>The activity log reads straight from on-chain events.</sub></td>
    <td width="50%" valign="top"><img src="docs/images/14-switched-off.jpg" alt="13 · Switch the assistant off" width="100%"><br><b>13 · Switch the assistant off</b><br><sub>One click, and any further draft is refused.</sub></td>
  </tr>
</table>

<sub>Screenshots are from the recorded demo on the previous deployment (factory `0xC128…80DA`), where amounts still read tUSD8. The app now shows dollars and asks for the payee's wallet when inviting.</sub>

## Architecture

```mermaid
flowchart LR
    W[Worker] -- "signs each pay line<br/>(EIP-712, no gas)" --> TS[Signed timesheet]
    TS --> AG[Assistant<br/>agent/ Node + TS]
    AG -- "proposeRun only,<br/>with the signatures" --> V[PayrollVault<br/>checks each signature]
    V -- "checkRun / recordRun" --> P[AgentSpendPolicy<br/>caps, expiry, revoke]
    F[PayrollVaultFactory] -- creates --> V
    F -- creates --> P
    V -- "register payee and agent" --> IR[IdentityRegistry<br/>ERC-8004 style]
    V -- "pays in one tx" --> T[(tUSD8)]
    O[Employer<br/>web/ app] -- "approve, sign and pay, pause, revoke" --> V
    O -- "set limits" --> P
    PY[Payee wallet] -- "confirmPayee" --> V
```

One payday, start to finish:

```mermaid
sequenceDiagram
    participant E as Employer
    participant Y as Payee (Ada)
    participant A as Assistant
    participant V as PayrollVault
    participant P as AgentSpendPolicy
    E->>V: invitePayee(hash(name, salt), Ada's wallet)
    Y->>V: confirmPayee(name, salt) from her own wallet
    Y->>A: signs her PayLine(payeeId, amount, memoHash), no gas
    Note over A: checks every signature off-chain first
    A->>V: proposeRun(payeeIds, amounts, memoHash, signatures)
    Note over V: verifies each signature against the wallet Ada confirmed
    V->>P: checkRun: agent? caps? expiry? revoked?
    P-->>V: ok, or a named error (the run is refused)
    Note over V: review window
    E->>V: approveRun(runKey)
    E->>V: executeRun(runKey)
    V->>P: recordRun: caps checked again, spend counted
    V->>Y: tUSD8 transfer
```

## How it works

1. **Vault.** An employer creates a vault through the factory and deposits tUSD8.
2. **Confirmation of payee.** The employer invites a payee by a hash of their name and a secret salt, and gives the payee's wallet address. The payee opens the invite link and confirms from that wallet. Any other wallet is refused with `UnexpectedWallet`, even one that copied the secret from a pending transaction. The confirmed wallet is registered in an ERC-8004 style identity registry. The owner can unlink a wrong wallet with `revokePayee`, which also retires that invite.
3. **Assistant permissions.** A separate policy contract holds the assistant's address, a per-run cap, a per-person cap, a period cap with its period, an expiry, and an off switch.
4. **Workers sign their pay lines.** Each worker signs their own line (name, amount, memo) with the wallet they confirmed. It is an EIP-712 signature, so it costs no gas. The assistant cannot invent or change a line without a signature the worker's wallet made.
5. **Propose.** The assistant calls `proposeRun(payeeIds, amounts, memoHash, signatures)`. The contract checks every signature against the confirmed wallet (`InvalidWorkerSignature` otherwise) and rejects anything outside the policy with a named error. A signed line can be paid once (`LineAlreadyPaid`).
6. **Review window.** Every run waits for the review window, counted from when it was proposed.
7. **Approve and pay.** The owner approves (or cancels), then calls `executeRun`, which pays everyone in one transaction. A run can execute once, and each proposal has a unique run key, so a retry cannot pay twice. A cancelled run can be drafted again.
8. **Pause.** `pause()` freezes proposing, approving and paying. Cancelling and withdrawing still work.

Every rejection is a custom error and every action emits an event. The web app turns both into plain English and links each event to the explorer.

## How it uses the QDay platform

| Piece | How PayWarden uses it |
| --- | --- |
| **Aevum testnet (chain 44005)** | All contracts and all settlement. Contracts are verified on the Aevum Blockscout explorer. |
| **tUSD8** (6 decimals) | The payroll currency: deposits, caps and payments are all in tUSD8 units (1 tUSD8 = 1,000,000). The app shows them as dollars. |
| **tQDAY** (18 decimals) | Gas for the employer, the assistant and each payee's one confirm. |
| **ERC-8004 identity** | Every confirmed payee and the assistant get an identity token from the `IdentityRegistry` (a reference implementation, credited in NOTICE). We'll switch to QDay's registry if one is published. |
| **Spending limits and scoped keys** | `AgentSpendPolicy` works like a scoped session key: one key, hard per-run, per-person and per-period caps, an expiry, and instant revoke. It's enforced on-chain at proposal and again at payment. Native ERC-4337 session keys are on the [roadmap](docs/ROADMAP.md). |
| **EVM version** | Aevum doesn't run `MCOPY` (Cancun), so the contracts are compiled for Shanghai (`evm_version = "shanghai"`, OpenZeppelin 5.1). |

## Deployments

Every deployment and the exact commit it was built from. Vaults and spend policies are created by the factory, so they come from the factory's commit.

| Deployment | Address | Built from commit | Deploy transaction |
| --- | --- | --- | --- |
| PayrollVaultFactory (current, verified) | [`0xfaC8…4209`](https://explorer-test.qday.info/address/0xfaC8ebb7D8f494618068B7eF86FF9A0767b34209) | [`c136c0a`](https://github.com/africtoby/paywarden/commit/c136c0a) | [`0x4bd3e6e9…7700`](https://explorer-test.qday.info/tx/0x4bd3e6e9f157308d8f5ae62242c81870e9773907950ae258608da1d156687700) |
| PayrollVaultFactory (previous, before worker signatures) | [`0x624C…198E`](https://explorer-test.qday.info/address/0x624C478779CCc80299bAa2A22833bab88e18198E) | [`feb30d4`](https://github.com/africtoby/paywarden/commit/feb30d4) | [`0xf24a4ac3…7101`](https://explorer-test.qday.info/tx/0xf24a4ac3ace4af062c13fbdb2f90d8bbfd05105f72d973e9e2d8f6e6c5ed7101) |
| IdentityRegistry (verified) | [`0x65b0…6F85`](https://explorer-test.qday.info/address/0x65b0B1df79B5A61021feF2BfA489a49A6b646F85) | [`652ecba`](https://github.com/africtoby/paywarden/commit/652ecba) | [`0xac68426f…1b22`](https://explorer-test.qday.info/tx/0xac68426f651d768b8a86deb395558199f394e603343c10f8ac21d55ac8ab1b22) |
| Demo vault + spend policy (worker-signed payday) | [`0xDa9E…3273`](https://explorer-test.qday.info/address/0xDa9E2AF624d26C0015E3e3a62BF2eEdD4bf13273), [`0x3B59…2e52`](https://explorer-test.qday.info/address/0x3B59877Ddd505EaAC80bA3DbE915570Da8742e52) | [`c136c0a`](https://github.com/africtoby/paywarden/commit/c136c0a) (via the factory) | [`0x88a51701…7f26`](https://explorer-test.qday.info/tx/0x88a51701ca116141dac8444c70a97d6843586f8f3aee7ba57546ca2101f97f26) |
| Earlier demo vault + spend policy | [`0x1712…3C76`](https://explorer-test.qday.info/address/0x171290CcBA179A9B8f89ff408134F09F33Da3C76), [`0x6dA8…fE40`](https://explorer-test.qday.info/address/0x6dA8BE510De086f61D9819906203b15AE433fE40) | [`feb30d4`](https://github.com/africtoby/paywarden/commit/feb30d4) (via the factory) | [`0x3f0ff2dd…1c83`](https://explorer-test.qday.info/tx/0x3f0ff2ddc376e7e5d1c78b55ccf0404277f5b83ac5e26b956202acb203261c83) |
| PayrollVaultFactory (previous, shown in the video) | [`0xC128…80DA`](https://explorer-test.qday.info/address/0xC12819acfEA15773cE49c001f6F23842cc4480DA) | [`078af3d`](https://github.com/africtoby/paywarden/commit/078af3d) | [`0xb9679ee7…cead`](https://explorer-test.qday.info/tx/0xb9679ee7101ceb1095c2a15bb67ffd1a9ec00dfb4eae00c812160ffd1cb5cead) |
| Web app | [paywarden.me](https://paywarden.me) | `main`, auto-deployed by Vercel on every push | n/a |
| tUSD8 (QDay's test stablecoin) | [`0x4565…3483`](https://explorer-test.qday.info/address/0x456569838f1d43009A91ebA4263147Afd7233483) | n/a | n/a |

- Network: QDay Aevum Testnet, chain id 44005
- RPC: https://rpc-test.qday.info
- Explorer: https://explorer-test.qday.info

## On-chain proof

**Attack test.** A script throws 63 attacks at a fresh vault on Aevum testnet: poisoned and inflated amounts, cap breaches, unconfirmed and look-alike payees, malformed drafts, replays, the assistant key trying owner powers (approve, pay, withdraw, raise its caps, take ownership), a copied invite, paused, expired and switched-off permissions, forged, tampered, reused and missing worker signatures, and prompt-injected timesheets through the agent's own pipeline. **63 of 63 refused, 0 wrong payments, 85 transactions.** 52 refusals are failed transactions on the explorer; 11 were stopped earlier by the agent. Full table with links: [docs/ATTACK-TEST.md](docs/ATTACK-TEST.md). Run it yourself with `cd agent && npm run attack-test`.

A full payday on the current contracts (factory `0xfaC8…4209`, vault `0xDa9E…3273`), 28 Nov 2026. Ada signed her own pay line, the assistant proposed it with her signature, and the contract checked it. The assistant's limits: $3 per run, $0.80 per person, $10 per 7 days, valid 90 days. Click any hash to open it on the explorer.

| Step | Transaction |
| --- | --- |
| Create vault (60 s review window) | [0x88a51701…7f26](https://explorer-test.qday.info/tx/0x88a51701ca116141dac8444c70a97d6843586f8f3aee7ba57546ca2101f97f26) |
| Deposit $0.50 | [0x785b5879…f218](https://explorer-test.qday.info/tx/0x785b5879f823fce927232e18d46e95f44990add328883903e9700452ebbaf218) |
| Set the assistant's limits | [0xeb6e1ce3…0fce](https://explorer-test.qday.info/tx/0xeb6e1ce30d9f1979f0d151bd216488acd01dcba0fcf212ef8ffa02fc4ad00fce) |
| Register the assistant's identity | [0x1a8470ed…b9ed](https://explorer-test.qday.info/tx/0x1a8470eda977c5fd8bc538b042d5f21001d5a34d30ad116669ff0d63b71db9ed) |
| Invite Ada, bound to her wallet | [0x2ca27d0c…d961](https://explorer-test.qday.info/tx/0x2ca27d0c719982a9cd31bb3e45c5edb8b71fdd747f36eaf095c140392f3fd961) |
| **Refused:** another wallet tries to confirm with Ada's secret (`UnexpectedWallet`) | [0x9055f17d…f3df](https://explorer-test.qday.info/tx/0x9055f17d6b11d31a859ad4ebfe72253597a6c9615861d17d7614181effa1f3df) |
| Ada confirms from her own wallet | [0xa9dbb3b1…9689](https://explorer-test.qday.info/tx/0xa9dbb3b183f8d94f4b266d6ffdbbd7fd29ed352d55c3bc68c60db674b1779689) |
| Ada signs her $0.50 line (EIP-712, off-chain, no gas, so no transaction) | n/a |
| Assistant drafts Ada's signed $0.50 run (agent CLI) | [0x94b0a801…6c30](https://explorer-test.qday.info/tx/0x94b0a80127db9bcd7c5d4ace7f8f8346ee0563d636d38709f3f72e6ca6886c30) |
| **Refused:** a line signed by the wrong key (`InvalidWorkerSignature`) | [0xfa525d12…a47a](https://explorer-test.qday.info/tx/0xfa525d12ef1c1b965b5d14a25e3555b32b3d6531cbcaa3d71a23b55d2347a47a) |
| **Refused:** a line with no signature (`InvalidWorkerSignature`) | [0x65321342…870f](https://explorer-test.qday.info/tx/0x6532134251d6f0dfc89323f5b352b95cca6f2e755a5ed11b899f73d78faa870f) |
| Owner approves | [0xdaba5573…20fd](https://explorer-test.qday.info/tx/0xdaba557382db29595fe59762e4548ad41864c371c63bdf4f43edbf6c418a20fd) |
| Owner signs and pays: $0.50 to Ada | [0x3f9c88f1…0318](https://explorer-test.qday.info/tx/0x3f9c88f12399a2da3a890525847fc136db45160816e57036bda76527065a0318) |
| **Refused:** the same signed line in a second run (`LineAlreadyPaid`) | [0x0c3c6baa…bcac](https://explorer-test.qday.info/tx/0x0c3c6baa99ee3964f140650c86b12b7ac60fe60d95953fafd87559939f1bbcac) |
| Owner switches the assistant off | [0xe495834f…db4f](https://explorer-test.qday.info/tx/0xe495834f0bc53127fdfd50c84ca2d258131a19738a72f572986708f82d05db4f) |
| **Refused:** the assistant tries to draft after the switch-off (`PolicyRevoked`) | [0xf2ee48f0…3c41](https://explorer-test.qday.info/tx/0xf2ee48f0fa621f815a210f44f867fbb1fe66cf23d74a6aa606166af007d83c41) |

The refused rows were sent on purpose, with a fixed gas limit, so the refusal is recorded on-chain. In normal use the agent simulates first and never sends them.

The demo video was recorded on an earlier deployment (factory `0xC128…80DA`), before workers signed their lines. That payday is also on the explorer: [pay transaction](https://explorer-test.qday.info/tx/0x5ee35c50dedf2b4aa8e92dbd6b405efde04146e0f280b52df94cb18afce87640).

## Run it yourself

You need Node 20 or newer, Git, and [Foundry](https://book.getfoundry.sh/getting-started/installation). Use test wallets only.

```bash
git clone https://github.com/africtoby/paywarden.git
cd paywarden
cp .env.example .env     # fill in test keys, never commit this file
```

<details>
<summary><b>Environment variables</b> (click to open)</summary>

All live in the root `.env` (copy of `.env.example`). The agent reads `agent/.env`, so copy the file there too.

| Variable | Used by | Required | What it is |
| --- | --- | --- | --- |
| `RPC_URL` | contracts, agent | yes | Aevum RPC, `https://rpc-test.qday.info` |
| `CHAIN_ID` | agent | yes | `44005` |
| `TUSD8_ADDRESS` | contracts (deploy) | yes | tUSD8 token address |
| `DEPLOYER_PRIVATE_KEY` | contracts (deploy) | to deploy | Test wallet that deploys the contracts; needs tQDAY |
| `FACTORY_ADDRESS` | reference | no | The deployed factory (the web app reads it from `web/src/lib/contracts.ts`) |
| `IDENTITY_REGISTRY_ADDRESS` | reference | no | The deployed identity registry |
| `AGENT_PRIVATE_KEY` | agent | yes | The assistant's test wallet. It must be the address set as the assistant in the app, and needs a little tQDAY. |
| `VAULT_ADDRESS` | agent | yes | Your vault (shown on the app's Overview page) |
| `USE_LLM_PARSER` | agent | no | `true` reads free-form timesheets with an LLM. `false` uses the plain parser. |
| `LLM_API_KEY` | agent | no | Anthropic API key for the LLM parser. Without it, the plain parser is used. |
| `LLM_MODEL` | agent | no | Model id for the LLM parser |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | web (`web/.env.local`) | no | WalletConnect project id, for phone wallets. Browser wallets work without it. |

</details>

### Contracts

```bash
cd contracts
forge build
forge test               # 75 tests: unit, fuzz, invariant and every revert path
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

Add the Aevum testnet to your wallet (chain id 44005, RPC above, symbol tQDAY). Get test tokens from the QDay faucet: [tQDAY for gas](https://faucet.qday.info/en) and [tUSD8 to pay with](https://faucet.qday.info/en?token=tusd8) (the payee wallet needs a little tQDAY too). In the app:

1. Connect, create a vault and deposit.
2. Set the assistant's permissions.
3. Invite a payee with their wallet address, and open the invite link with that wallet to confirm.

Back up the invite list from the Payees page: invite links are kept only in your browser.

### Agent

```bash
cd agent
npm install
cp ../.env .env          # set AGENT_PRIVATE_KEY and VAULT_ADDRESS
```

Create `payees.json` with the names and salts you invited (the salt is in the invite link):

```json
[{ "name": "Ada Lovelace", "salt": "0x..." }]
```

```bash
npm run propose -- signed-timesheet.json payees.json
```

The assistant proposes from a signed timesheet: `{ "memo": "Week 12", "lines": [{ "name": "Ada Lovelace", "amount": "1020.00", "signature": "0x..." }] }`. Each worker makes their line and signature on the app's `/hours` page (hours x rate, signed with their confirmed wallet, no gas). The agent checks every signature off-chain and names the person if one is missing or wrong. A plain timesheet (lines of `name, hours, rate`, optional first line `memo: Week 12`) is read by the rule parser, or by an LLM if a key is set (`USE_LLM_PARSER=false` forces the rule parser); that gives the amounts the workers then sign. Either way, plain code validates the result and simulates the call before sending it. It retries with backoff and waits for receipts. The contract is the final judge: a poisoned timesheet that passes the agent's checks is still refused on-chain.

```bash
npm test                 # includes a local-chain test that deploys the real contracts
npm run attack-test      # 63 attacks against a fresh vault on Aevum testnet; writes docs/ATTACK-TEST.md
```

The integration test needs `anvil` and a built `contracts/out` (`forge build`). It is skipped if `anvil` is missing.

## API examples

<details>
<summary><b>Contract calls with <code>cast</code></b> (click to open)</summary>

Calls with Foundry's `cast` (amounts are tUSD8 units: `500000` = $0.50).

```bash
# Owner: set the assistant's limits: agent, perRun, perPayee, periodCap, period (s), expiry (unix)
cast send $POLICY "setPolicy((address,uint256,uint256,uint256,uint64,uint64))" \
  "($AGENT,3000000,800000,10000000,604800,1767225600)" --private-key $OWNER_KEY --rpc-url $RPC_URL

# Owner: invite a payee bound to their wallet
ID=$(cast call $VAULT "commitmentOf(string,bytes32)(bytes32)" "Ada" $SALT --rpc-url $RPC_URL)
cast send $VAULT "invitePayee(bytes32,address)" $ID $ADA_WALLET --private-key $OWNER_KEY --rpc-url $RPC_URL

# Payee: confirm from that wallet
cast send $VAULT "confirmPayee(string,bytes32)" "Ada" $SALT --private-key $ADA_KEY --rpc-url $RPC_URL

# Assistant: draft a run (its only power)
# SIG is Ada's EIP-712 PayLine(payeeId, amount, memoHash) signature, made in the app at /hours
cast send $VAULT "proposeRun(bytes32[],uint256[],bytes32,bytes[])" "[$ID]" "[500000]" $(cast keccak "Week 48") "[$SIG]" \
  --private-key $AGENT_PRIVATE_KEY --rpc-url $RPC_URL

# Owner: approve, then pay once the review window has passed
cast send $VAULT "approveRun(bytes32)" $RUN_KEY --private-key $OWNER_KEY --rpc-url $RPC_URL
cast send $VAULT "executeRun(bytes32)" $RUN_KEY --private-key $OWNER_KEY --rpc-url $RPC_URL

# Owner: instant off switch for the assistant, or freeze everything
cast send $POLICY "revoke()" --private-key $OWNER_KEY --rpc-url $RPC_URL
cast send $VAULT "pause()" --private-key $OWNER_KEY --rpc-url $RPC_URL
```

The run key is `keccak256(abi.encode(payeeIds, amounts, memoHash))`, which is also the return value of `proposeRun` and indexed in the `RunProposed` event.

</details>

## Safety notes

- The assistant key can only call `proposeRun`. It cannot approve, pay, withdraw or change limits. The [attack test](docs/ATTACK-TEST.md) tries each of those on-chain and records the refusal.
- Caps are enforced on-chain at proposal time and again at payment time.
- Payee names and salts stay in the employer's browser; the chain stores only the hash.
- Every invite made in the app is bound to the payee's wallet, so only that wallet can confirm it, even if someone copies the link or sees the secret in a pending transaction (proven on-chain: `UnexpectedWallet`). The contract also accepts an open invite (`address(0)`) for direct integrations; the app never sends one.
- Test tokens and test wallets only. This code has not been audited.

## Known constraints

- If one transfer in a run fails, the whole run reverts and nobody in it is paid. That's safe (no partial payroll), but one bad payee blocks the run until it's fixed.
- The same payees, amounts and memo give the same run key, so a paid run can't be drafted twice. Put the period in the memo (for example `memo: Week 48`).
- Invite links live in the employer's browser. Use Back up invites on the Payees page.
- No ERC-4337 smart accounts or paymaster yet. See the [roadmap](docs/ROADMAP.md).

## Roadmap

Who it's for, the business model and the path to mainnet: [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

| Folder | What it is |
| --- | --- |
| `contracts/` | Foundry project: `PayrollVault`, `PayrollVaultFactory`, `AgentSpendPolicy`, `IdentityRegistry` |
| `web/` | Next.js, wagmi, viem, RainbowKit, Tailwind app for the employer and the payee |
| `agent/` | Node and TypeScript service that turns a timesheet into a guarded `proposeRun` |
| `docs/` | How it works (with a real testnet case study), roadmap, and README images |

## Licence

MIT. See [LICENSE](LICENSE). Third-party notices are in [NOTICE](NOTICE).
