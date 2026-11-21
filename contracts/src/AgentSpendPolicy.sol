// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentSpendPolicy
/// @notice Reusable spending guardrails for one agent. All amounts are raw token units
///         (tUSD8 = 6 decimals). The policy never moves funds; the bound vault asks it to
///         validate and record spend. The agent can only propose, never execute.
contract AgentSpendPolicy is Ownable {
    struct Policy {
        address agent;
        uint256 perRun; // max total of one run
        uint256 perPayee; // max amount to one payee in one run
        uint256 periodCap; // max total per period window
        uint64 period; // window length in seconds
        uint64 expiry; // unix time after which the agent has no authority (0 = never)
    }

    Policy public policy;
    bool public revoked;
    address public vault;
    address public immutable binder; // deployer (factory); may bind the vault once
    uint64 public periodStart;
    uint256 public periodSpent;

    error NotVault();
    error NotBinder();
    error VaultAlreadyBound();
    error InvalidPolicy();
    error NotAgent();
    error PolicyRevoked();
    error PolicyExpired();
    error LengthMismatch();
    error PerRunCapExceeded(uint256 total, uint256 cap);
    error PerPayeeCapExceeded(bytes32 payeeId, uint256 amount, uint256 cap);
    error PeriodCapExceeded(uint256 total, uint256 remaining);

    event VaultBound(address indexed vault);
    event PolicySet(
        address indexed agent, uint256 perRun, uint256 perPayee, uint256 periodCap, uint64 period, uint64 expiry
    );
    event PolicyRevokedByOwner(address indexed agent);
    event SpendRecorded(uint256 total, uint256 periodSpent, uint64 periodStart);

    constructor(address owner_) Ownable(owner_) {
        binder = msg.sender;
    }

    function bindVault(address vault_) external {
        if (msg.sender != binder) revert NotBinder();
        if (vault != address(0)) revert VaultAlreadyBound();
        vault = vault_;
        emit VaultBound(vault_);
    }

    /// @notice Sets (or replaces) the agent limits. Also lifts a previous revoke and starts a new period window.
    function setPolicy(Policy calldata p) external onlyOwner {
        if (p.agent == address(0) || p.period == 0 || p.perRun == 0 || p.perPayee == 0 || p.periodCap == 0) {
            revert InvalidPolicy();
        }
        policy = p;
        revoked = false;
        periodStart = uint64(block.timestamp);
        periodSpent = 0;
        emit PolicySet(p.agent, p.perRun, p.perPayee, p.periodCap, p.period, p.expiry);
    }

    /// @notice Instantly removes all agent authority.
    function revoke() external onlyOwner {
        revoked = true;
        emit PolicyRevokedByOwner(policy.agent);
    }

    function agent() external view returns (address) {
        return policy.agent;
    }

    /// @notice Validates a proposal from `caller`. Reverts with a specific error on any breach.
    function checkRun(address caller, bytes32[] calldata payeeIds, uint256[] calldata amounts) external view {
        if (caller == address(0) || caller != policy.agent) revert NotAgent();
        _check(payeeIds, amounts);
    }

    /// @notice Re-validates and records spend at execution time. Only the vault may call.
    function recordRun(bytes32[] calldata payeeIds, uint256[] calldata amounts) external {
        if (msg.sender != vault) revert NotVault();
        uint256 total = _check(payeeIds, amounts);
        (uint64 start, uint256 spent) = _window();
        periodStart = start;
        periodSpent = spent + total;
        emit SpendRecorded(total, periodSpent, start);
    }

    /// @notice Amount still spendable in the current period window.
    function remainingInPeriod() external view returns (uint256) {
        (, uint256 spent) = _window();
        return spent >= policy.periodCap ? 0 : policy.periodCap - spent;
    }

    function _check(bytes32[] calldata payeeIds, uint256[] calldata amounts) internal view returns (uint256 total) {
        if (revoked) revert PolicyRevoked();
        Policy memory p = policy;
        if (p.expiry != 0 && block.timestamp > p.expiry) revert PolicyExpired();
        if (payeeIds.length != amounts.length) revert LengthMismatch();
        for (uint256 i; i < amounts.length; ++i) {
            if (amounts[i] > p.perPayee) revert PerPayeeCapExceeded(payeeIds[i], amounts[i], p.perPayee);
            total += amounts[i];
        }
        if (total > p.perRun) revert PerRunCapExceeded(total, p.perRun);
        (, uint256 spent) = _window();
        if (spent + total > p.periodCap) {
            revert PeriodCapExceeded(total, spent >= p.periodCap ? 0 : p.periodCap - spent);
        }
    }

    /// @dev Fixed windows anchored at the time the policy was set; spend resets when a window ends.
    function _window() internal view returns (uint64 start, uint256 spent) {
        start = periodStart;
        spent = periodSpent;
        uint64 len = policy.period;
        if (len != 0 && block.timestamp >= uint256(start) + len) {
            start += uint64(((block.timestamp - start) / len) * len);
            spent = 0;
        }
    }
}
