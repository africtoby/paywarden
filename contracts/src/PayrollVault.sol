// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AgentSpendPolicy} from "./AgentSpendPolicy.sol";

interface IIdentityRegistry is IERC721 {
    function register() external returns (uint256 agentId);
}

/// @title PayrollVault
/// @notice Employer-owned vault holding tUSD8 (6 decimals; every amount here is a raw 6-dp unit).
///         An agent may only propose runs inside the AgentSpendPolicy limits. The owner approves
///         after a review window and executes; pause() freezes everything except cancel/withdraw.
contract PayrollVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Proposed,
        Approved,
        Cancelled,
        Executed
    }

    struct Run {
        bytes32[] payeeIds;
        uint256[] amounts;
        bytes32 memoHash;
        uint256 total;
        uint64 proposedAt;
        uint64 executableAt;
        Status status;
    }

    uint256 public constant MAX_PAYEES = 50;

    IERC20 public immutable token;
    AgentSpendPolicy public immutable policy;
    IIdentityRegistry public immutable registry; // address(0) disables identity registration
    uint64 public reviewWindow;

    mapping(bytes32 payeeId => bool) public invited;
    mapping(bytes32 payeeId => address) public payeeWallet;
    mapping(address wallet => bytes32) public walletPayee;
    mapping(bytes32 payeeId => uint256) public payeeIdentityId;
    mapping(bytes32 runKey => Run) private _runs;

    error NotAgent();
    error ZeroAmount();
    error ZeroAddress();
    error EmptyRun();
    error TooManyPayees(uint256 count);
    error LengthMismatch();
    error DuplicatePayee(bytes32 payeeId);
    error PayeeNotConfirmed(bytes32 payeeId);
    error AlreadyInvited(bytes32 payeeId);
    error NotInvited(bytes32 payeeId);
    error AlreadyConfirmed(bytes32 payeeId);
    error WalletAlreadyBound(address wallet);
    error DuplicateRun(bytes32 runKey);
    error UnknownRun(bytes32 runKey);
    error RunNotProposed(bytes32 runKey, Status status);
    error RunNotApproved(bytes32 runKey, Status status);
    error RunNotCancellable(bytes32 runKey, Status status);
    error ReviewWindowOpen(uint64 executableAt);
    error InsufficientBalance(uint256 needed, uint256 available);

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ReviewWindowSet(uint64 reviewWindow);
    event PayeeInvited(bytes32 indexed payeeId);
    event PayeeConfirmed(bytes32 indexed payeeId, address indexed wallet, uint256 identityId);
    event PayeeRevoked(bytes32 indexed payeeId, address indexed wallet);
    event AgentIdentityRegistered(address indexed agent, uint256 identityId);
    event RunProposed(
        bytes32 indexed runKey, address indexed agent, bytes32 memoHash, uint256 total, uint64 executableAt
    );
    event RunApproved(bytes32 indexed runKey, address indexed owner);
    event RunCancelled(bytes32 indexed runKey, address indexed owner);
    event RunExecuted(bytes32 indexed runKey, uint256 total, uint256 payees);
    event PayeePaid(bytes32 indexed runKey, bytes32 indexed payeeId, address indexed wallet, uint256 amount);

    constructor(
        address owner_,
        IERC20 token_,
        AgentSpendPolicy policy_,
        IIdentityRegistry registry_,
        uint64 reviewWindow_
    ) Ownable(owner_) {
        if (address(token_) == address(0) || address(policy_) == address(0)) revert ZeroAddress();
        token = token_;
        policy = policy_;
        registry = registry_;
        reviewWindow = reviewWindow_;
    }

    // ---------------------------------------------------------------- funds

    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        token.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function setReviewWindow(uint64 window) external onlyOwner {
        reviewWindow = window; // applies to proposals made after this call
        emit ReviewWindowSet(window);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ----------------------------------------------- confirmation of payee

    /// @notice Commitment the owner invites with and the payee confirms: keccak256(abi.encode(name, salt)).
    function commitmentOf(string calldata name, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(name, salt));
    }

    function invitePayee(bytes32 payeeId) external onlyOwner {
        if (invited[payeeId]) revert AlreadyInvited(payeeId);
        invited[payeeId] = true;
        emit PayeeInvited(payeeId);
    }

    /// @notice The payee's own wallet proves it knows (name, salt) and binds itself to the invite.
    function confirmPayee(string calldata name, bytes32 salt) external {
        bytes32 payeeId = commitmentOf(name, salt);
        if (!invited[payeeId]) revert NotInvited(payeeId);
        if (payeeWallet[payeeId] != address(0)) revert AlreadyConfirmed(payeeId);
        if (walletPayee[msg.sender] != bytes32(0)) revert WalletAlreadyBound(msg.sender);
        payeeWallet[payeeId] = msg.sender;
        walletPayee[msg.sender] = payeeId;
        uint256 identityId = _registerIdentityFor(msg.sender);
        payeeIdentityId[payeeId] = identityId;
        emit PayeeConfirmed(payeeId, msg.sender, identityId);
    }

    /// @notice Unlinks a payee's wallet (wrong wallet, lost key). The invite stays open, so the payee can confirm again.
    function revokePayee(bytes32 payeeId) external onlyOwner {
        address wallet = payeeWallet[payeeId];
        if (wallet == address(0)) revert PayeeNotConfirmed(payeeId);
        delete payeeWallet[payeeId];
        delete walletPayee[wallet];
        emit PayeeRevoked(payeeId, wallet);
    }

    /// @notice Registers the agent in the identity registry; the identity token is sent to the agent.
    function registerAgentIdentity() external onlyOwner returns (uint256 identityId) {
        address agent = policy.agent();
        if (agent == address(0)) revert ZeroAddress();
        identityId = _registerIdentityFor(agent);
        emit AgentIdentityRegistered(agent, identityId);
    }

    function _registerIdentityFor(address account) internal returns (uint256 identityId) {
        if (address(registry) == address(0)) return 0;
        identityId = registry.register();
        registry.transferFrom(address(this), account, identityId);
    }

    // ----------------------------------------------------------- run flow

    /// @notice Agent-only. Creates a pending run; runKey is derived from the content, so a retry reverts.
    function proposeRun(bytes32[] calldata payeeIds, uint256[] calldata amounts, bytes32 memoHash)
        external
        whenNotPaused
        returns (bytes32 runKey)
    {
        uint256 n = payeeIds.length;
        if (n == 0) revert EmptyRun();
        if (n > MAX_PAYEES) revert TooManyPayees(n);
        if (n != amounts.length) revert LengthMismatch();

        policy.checkRun(msg.sender, payeeIds, amounts); // reverts NotAgent / cap errors

        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (amounts[i] == 0) revert ZeroAmount();
            if (payeeWallet[payeeIds[i]] == address(0)) revert PayeeNotConfirmed(payeeIds[i]);
            for (uint256 j; j < i; ++j) {
                if (payeeIds[j] == payeeIds[i]) revert DuplicatePayee(payeeIds[i]);
            }
            total += amounts[i];
        }

        runKey = keccak256(abi.encode(payeeIds, amounts, memoHash));
        Run storage r = _runs[runKey];
        if (r.status != Status.None) revert DuplicateRun(runKey);

        r.payeeIds = payeeIds;
        r.amounts = amounts;
        r.memoHash = memoHash;
        r.total = total;
        r.proposedAt = uint64(block.timestamp);
        r.executableAt = uint64(block.timestamp) + reviewWindow;
        r.status = Status.Proposed;
        emit RunProposed(runKey, msg.sender, memoHash, total, r.executableAt);
    }

    function approveRun(bytes32 runKey) external onlyOwner whenNotPaused {
        Run storage r = _runs[runKey];
        if (r.status == Status.None) revert UnknownRun(runKey);
        if (r.status != Status.Proposed) revert RunNotProposed(runKey, r.status);
        r.status = Status.Approved;
        emit RunApproved(runKey, msg.sender);
    }

    /// @notice Allowed while paused so the owner can always withdraw a pending run.
    function cancelRun(bytes32 runKey) external onlyOwner {
        Run storage r = _runs[runKey];
        if (r.status == Status.None) revert UnknownRun(runKey);
        if (r.status != Status.Proposed && r.status != Status.Approved) revert RunNotCancellable(runKey, r.status);
        r.status = Status.Cancelled;
        emit RunCancelled(runKey, msg.sender);
    }

    /// @notice Pays every payee in one transaction. A run can execute once only.
    function executeRun(bytes32 runKey) external onlyOwner whenNotPaused nonReentrant {
        Run storage r = _runs[runKey];
        if (r.status == Status.None) revert UnknownRun(runKey);
        if (r.status != Status.Approved) revert RunNotApproved(runKey, r.status);
        if (block.timestamp < r.executableAt) revert ReviewWindowOpen(r.executableAt);

        r.status = Status.Executed; // effects before interactions

        policy.recordRun(r.payeeIds, r.amounts); // re-checks revoke / expiry / caps and counts the spend

        uint256 balance = token.balanceOf(address(this));
        if (balance < r.total) revert InsufficientBalance(r.total, balance);

        uint256 n = r.payeeIds.length;
        for (uint256 i; i < n; ++i) {
            bytes32 payeeId = r.payeeIds[i];
            address wallet = payeeWallet[payeeId];
            if (wallet == address(0)) revert PayeeNotConfirmed(payeeId); // unlinked after the draft
            token.safeTransfer(wallet, r.amounts[i]);
            emit PayeePaid(runKey, payeeId, wallet, r.amounts[i]);
        }
        emit RunExecuted(runKey, r.total, n);
    }

    function getRun(bytes32 runKey) external view returns (Run memory) {
        return _runs[runKey];
    }

    function runStatus(bytes32 runKey) external view returns (Status) {
        return _runs[runKey].status;
    }
}
