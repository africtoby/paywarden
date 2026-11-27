import { BaseError, ContractFunctionRevertedError } from "viem";
import { formatDuration, formatMoney } from "./format";

type Args = readonly unknown[];

const amt = (v: unknown) => formatMoney(v as bigint);

/** Plain-English sentence for each custom error the contracts can raise. */
export const MESSAGES: Record<string, (a: Args) => string> = {
  NotAgent: () => "Only the assistant you authorised can draft runs. Check the assistant address in Permissions.",
  ZeroAmount: () => "An amount of zero is not allowed. Enter an amount above zero.",
  ZeroAddress: () => "That address is empty. Enter a full wallet address.",
  EmptyRun: () => "A run needs at least one payee.",
  TooManyPayees: () => "That run has too many payees. Split it into smaller runs.",
  LengthMismatch: () => "The payee list and amount list do not match in length.",
  DuplicatePayee: () => "The same payee appears twice in this run. Combine them into one line.",
  PayeeNotConfirmed: () => "One payee has not confirmed their wallet yet. Ask them to open their invite link.",
  AlreadyInvited: () => "You have already invited this payee. Use a new salt to invite them again.",
  NotInvited: () => "This invite does not exist. Check the link, or ask the employer to send a new one.",
  AlreadyConfirmed: () => "This payee has already confirmed.",
  WalletAlreadyBound: () => "This wallet is already linked to another payee. Use a different wallet.",
  UnexpectedWallet: (a) => `This invite is for a different wallet (${String(a[0]).slice(0, 6)}…${String(a[0]).slice(-4)}). Connect that wallet to confirm.`,
  DuplicateRun: () => "This exact run was already drafted, so it will not be paid twice.",
  UnknownRun: () => "That run does not exist.",
  RunNotProposed: () => "This run is no longer waiting for approval.",
  RunNotApproved: () => "Approve this run before you sign and pay.",
  RunNotCancellable: () => "This run can no longer be cancelled.",
  ReviewWindowOpen: (a) => {
    const at = Number(a[0]);
    const left = Math.max(0, at - Math.floor(Date.now() / 1000));
    return `The review window is still open. You can sign and pay in ${formatDuration(left)}.`;
  },
  InsufficientBalance: (a) => `The vault holds ${amt(a[1])} but this run needs ${amt(a[0])}. Deposit more first.`,
  NotVault: () => "Only the vault can do that.",
  NotBinder: () => "Only the factory can set this up.",
  VaultAlreadyBound: () => "This policy is already linked to a vault.",
  InvalidPolicy: () => "Those permission limits do not make sense together. Check the caps, period and expiry.",
  PolicyRevoked: () => "You turned off the assistant's permissions. Set new permissions to let it draft runs again.",
  PolicyExpired: () => "The assistant's permission has expired. Set a later expiry.",
  PerRunCapExceeded: (a) => `Refused by the contract: this run totals ${amt(a[0])}, above the per-run cap of ${amt(a[1])}.`,
  PerPayeeCapExceeded: (a) => `Refused by the contract: one payee would get ${amt(a[1])}, above the per-person cap of ${amt(a[2])}.`,
  PeriodCapExceeded: (a) => `Refused by the contract: this run totals ${amt(a[0])} but only ${amt(a[1])} is left in this period.`,
  EnforcedPause: () => "The vault is paused. Unpause it to continue.",
  ExpectedPause: () => "The vault is not paused.",
  OwnableUnauthorizedAccount: () => "Only the vault owner can do that. Connect the owner wallet.",
  OwnableInvalidOwner: () => "That owner address is not valid. Enter a full wallet address.",
  SafeERC20FailedOperation: () => "The tUSD8 transfer failed. Check your balance and that you approved the vault, then try again.",
  ReentrancyGuardReentrantCall: () => "Something went wrong. Try again.",
  NotAuthorized: () => "You are not allowed to change this identity.",
  EmptyMetadataKey: () => "The metadata key cannot be empty.",
  ERC20InsufficientBalance: () => "Your wallet does not hold enough tUSD8.",
  ERC20InsufficientAllowance: () => "The vault is not yet allowed to take that amount. Approve it first.",
};

/** Turn a decoded custom error into a sentence. Returns null for unknown names. */
export function explainRevert(name: string, args: Args = []): string | null {
  const fn = MESSAGES[name];
  return fn ? fn(args) : null;
}

/** Turn any wallet or contract failure into one calm sentence. Never shows a raw revert string. */
export function explainError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      // tUSD8 reports its own failures as plain text rather than custom errors.
      if (/exceeds balance/i.test(revert.reason ?? "")) return "Your wallet does not hold enough tUSD8.";
      if (/exceeds allowance/i.test(revert.reason ?? "")) return "The vault is not yet allowed to take that amount. Approve it first.";
      const name = revert.data?.errorName;
      if (name) {
        return explainRevert(name, revert.data?.args ?? []) ?? "The contract refused this action. Check the details and try again.";
      }
    }
    const msg = err.shortMessage ?? err.message;
    if (/user rejected|denied/i.test(msg)) return "You cancelled the request in your wallet.";
    if (/insufficient funds/i.test(msg)) return "Your wallet needs a little tQDAY to pay the network fee.";
    if (/revert|invalid opcode|execution failed/i.test(msg)) {
      console.error("Transaction refused by the network:", msg);
      return "The network refused this transaction, so nothing was sent. Details are in the browser console.";
    }
  }
  return "Something went wrong. Check your connection and try again.";
}
