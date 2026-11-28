# Internal security review

**Date:** 28 Nov 2026
**Code reviewed:** `contracts/src/` at commit [`19a72a8`](https://github.com/africtoby/paywarden/commit/19a72a8) (816 lines across 7 files)
**Result:** 1 medium finding, fixed and redeployed. 8 low or informational findings, acknowledged with reasons. No open high or medium issues.

This is the project's own review, not an external audit. It was done with public tools and checklists, and everything it found is listed below. An independent audit is planned before any mainnet deployment (see [ROADMAP](ROADMAP.md)).

## Scope

| Contract | What it does | Deployed |
| --- | --- | --- |
| `PayrollVault` | Holds tUSD8, payees, runs; worker-signed pay lines; owner approve and pay | via factory `0xfaC8…4209` |
| `PayrollVaultFactory` | One vault and policy per employer | [`0xfaC8…4209`](https://explorer-test.qday.info/address/0xfaC8ebb7D8f494618068B7eF86FF9A0767b34209) |
| `AgentSpendPolicy` | The assistant's caps, expiry and off switch | via factory |
| `IdentityRegistry` | ERC-8004 style identity tokens | [`0x65b0…6F85`](https://explorer-test.qday.info/address/0x65b0B1df79B5A61021feF2BfA489a49A6b646F85) |
| `AgentAccount` | ERC-4337 smart account with a scoped session key | via factory below |
| `AgentAccountFactory` | CREATE2 accounts | [`0x8AD2…92Bb`](https://explorer-test.qday.info/address/0x8AD21c204984B915498a98DaBcd7A7AcC03392Bb) (fixed version) |
| `IEntryPointV07` | ERC-4337 v0.7 types (interface only) | n/a |

The agent and web app had a lighter check. No private keys or secrets are in the repository or its history. The web app never asks for a private key; users sign in their own wallet. Worker signatures are checked by the agent before sending, and always again by the contract.

## Method

1. **Static analysis.** [Slither](https://github.com/crytic/slither) 0.11.6 (Trail of Bits) on `contracts/src`, all 102 detectors, dependencies excluded. Every result was triaged by hand (below).
2. **Manual review**, following the Trail of Bits *building-secure-contracts* checklists:
   - access control on every external function
   - reentrancy, and the order of checks, effects and interactions
   - signatures: EIP-712 domain, replay across vaults and chains, malleability, ERC-1271, the ERC-4337 user-operation hash and nonce
   - the session key's call filter, including calldata encoding tricks
   - arithmetic and units: tUSD8 has 6 decimals and gas has 18; the period window; casts
   - denial of service and loop bounds
   - token assumptions
   - front-running
   - ERC-4337 validation rules: storage use during validation, and gas use of the deposit
3. **Tests as evidence.** Each property below is backed by a test that fails if the property breaks:
   - 123 Foundry tests: unit, fuzz with 10,000 runs each, and 4 invariants of 512 runs × 64 calls
   - line coverage of the contract source: 99.7%
   - 41 agent tests, including local-chain runs against the canonical EntryPoint v0.7 bytecode
4. **On-chain adversarial test:** 63 attacks on Aevum testnet, 63 refused, 0 wrong payments ([ATTACK-TEST.md](ATTACK-TEST.md)).

## Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| PW-01 | Medium | **A session key could spend the smart account's gas deposit.** A session operation could set any gas price and gas limit. Someone holding a stolen session key who also submits the operation (acts as the bundler) gets refunded at that inflated price from the account's EntryPoint deposit. They still could not move payroll money or do anything but propose. | **Fixed** in [`19a72a8`](https://github.com/africtoby/paywarden/commit/19a72a8). The owner now sets `sessionMaxFeePerGas` with the session key, and session operations must stay under it and under `MAX_SESSION_GAS` (2,000,000), or validation fails (`AA24`). Tests: `test_session_key_cannot_overpay_for_gas`, `test_session_key_cannot_ask_for_too_much_gas`, `testFuzz_session_gas_bounded`. Redeployed as factory `0x8AD2…92Bb`, and the refusal is recorded on-chain: [0x405b26f4…e051](https://explorer-test.qday.info/tx/0x405b26f48b30165b1201c6ee594830889dde94339913ab444c08a3809d20e051). |
| PW-02 | Low | **Switching the assistant off also blocks paying runs it already drafted.** At payment, `recordRun` re-checks the policy, so after `revoke()` or expiry the owner cannot execute an approved run until they set the policy again. | Acknowledged, by design. It fails safe: switch-off freezes everything the assistant started. Test: `test_propose_after_revoke_or_expiry_reverts`. |
| PW-03 | Low | **`setPolicy` restarts the period window**, so the period cap counts from that moment. | Acknowledged. Owner only; changing the limits deliberately starts a fresh period. |
| PW-04 | Low | **An open invite (`wallet = address(0)`) can be front-run:** whoever sees the name and salt in the mempool can confirm first. | Acknowledged. The web app always binds the invite to the payee's wallet (`UnexpectedWallet`, proven on-chain). Only direct contract callers can make an open invite, and the NatSpec warns them. |
| PW-05 | Info | **One failing transfer reverts the whole run.** | Acknowledged, by design: no partial payroll. The owner removes or fixes the payee and proposes again. |
| PW-06 | Info | **The assistant can create many pending proposals.** | Acknowledged. They cost the assistant gas, move no money, pass the caps at proposal and again at payment, and the owner can cancel them or switch the assistant off. |
| PW-07 | Info | **A review window near `type(uint64).max` makes `proposeRun` revert** (checked overflow). | Acknowledged. Only the owner can set it, and doing so only blocks their own assistant. |
| PW-08 | Info | **`AgentAccount.owner` is immutable.** If the owner key is lost, the gas deposit stays in the EntryPoint. | Acknowledged. Keep the deposit small; create a new account for a new owner. |
| PW-09 | Info | **Token assumptions.** The vault assumes a standard ERC-20 (no fee on transfer, no rebasing). The token is fixed at deploy time to tUSD8. | Acknowledged. SafeERC20 is used for every transfer. |

## Slither results (24), triaged

| Detector | Where | Verdict |
| --- | --- | --- |
| divide-before-multiply (Medium) | `AgentSpendPolicy._window` | False positive: the rounding down to the window start is intended. |
| uninitialized-local (Medium) | `PayrollVault.proposeRun` `total` | False positive: Solidity initialises it to 0, which is what we want. |
| unused-return (Medium) | `AgentAccount._validate` `tryRecover` | False positive: the third return value (error argument) is not needed; the error code is checked. |
| missing-zero-check (Low) | `AgentAccount.execute` target, `AgentSpendPolicy.bindVault` | By design: `execute` is owner or EntryPoint only; `bindVault` is called once by the factory with a fresh vault. |
| reentrancy-benign / reentrancy-events (Low) | `confirmPayee`, `executeRun`, `registerAgentIdentity`, `createVault`, `execute` | Reviewed. The only external calls are to the fixed registry and token (trusted, set at deploy), or are owner-initiated. `executeRun` sets `Executed` and `paidLine` before any transfer and is `nonReentrant`. |
| timestamp (Low) | review window, period window, expiry | By design. Time-based rules with minute-scale tolerance; validator influence of a few seconds does not matter here. |
| assembly, low-level-calls (Info) | `AgentAccount.execute`, `validateUserOp` | Expected: bubbling up revert data, and paying the EntryPoint prefund, as the ERC-4337 reference account does. |
| cyclomatic-complexity, missing-inheritance, redundant-statements, too-many-digits (Info) | various | Style only; no effect on behaviour. |

## Properties and the tests that back them

| Property | Evidence |
| --- | --- |
| Only the assistant can propose; only the owner can approve, pay, withdraw, pause | `test_propose_only_agent`, `test_agent_cannot_approve_cancel_execute`, attack test |
| Every pay line is signed by that payee's confirmed wallet | `WorkerSignatures.t.sol` (20 tests incl. 3 fuzz), on-chain `InvalidWorkerSignature` refusals |
| A signed line is paid at most once | `invariant_line_paid_at_most_once`, `test_paid_line_refused_at_execute` |
| Payouts stay within the period cap | `invariant_payouts_within_period_cap`, `testFuzz_period_cap_holds` |
| The vault balance falls by exactly what was paid | `invariant_balance_matches_payouts` |
| A run executes at most once | `invariant_run_executes_once`, `test_execute_twice_reverts` |
| The session key can only propose, only on one vault, only before expiry, only within the gas cap | `AgentAccount.t.sol` (28 tests incl. 3 fuzz), on-chain `AA24` refusals |
| Signatures cannot be replayed on another vault or chain | `test_signature_for_other_vault_reverts`, `test_signature_for_other_chain_reverts`, `test_replayed_user_operation_refused` |

## What this review is not

- Not an independent audit, and not formal verification.
- It covers the contracts listed above at the commit above. Later changes need a new review.
- Testnet only. Do not use with real funds before an external audit.
