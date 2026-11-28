// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {PayrollVault} from "../src/PayrollVault.sol";

/// @dev Drives random propose/approve/cancel/execute calls and tracks what actually left the vault.
contract Handler is Base {
    uint256 public paidOut;
    uint256 public executions;
    bytes32[] public keys;
    mapping(bytes32 => uint256) public timesExecuted;
    /// @dev How many times each (payee, memo) line was actually paid.
    mapping(bytes32 payeeId => mapping(bytes32 memo => uint256)) public timesLinePaid;
    bytes32[4] internal memos = [keccak256("w1"), keccak256("w2"), keccak256("w3"), keccak256("w4")];

    function setUp() public override {}

    function wire(PayrollVault v, address agent_, address employer_, bytes32 a, bytes32 b) external {
        vault = v;
        agent = agent_;
        employer = employer_;
        aliceId = a;
        bobId = b;
        payeeKey[a] = ALICE_KEY;
        payeeKey[b] = BOB_KEY;
    }

    function memoAt(uint256 i) external view returns (bytes32) {
        return memos[i];
    }

    /// @dev Memos come from a small set (four pay periods) so runs keep competing for the same lines;
    /// `which` picks Alice, Bob or both.
    function propose(uint256 x, uint256 y, uint256 memo, uint256 which) external {
        x = bound(x, 1, 4_000 * USD);
        y = bound(y, 1, 4_000 * USD);
        bytes32 m = memos[memo % memos.length];
        which = which % 3;
        bytes32[] memory ids = which == 0 ? _one(aliceId) : which == 1 ? _one(bobId) : _ids(aliceId, bobId);
        uint256[] memory amts = which == 2 ? _amts(x, y) : _oneAmt(x);
        bytes[] memory sigs = _sigs(ids, amts, m);
        vm.prank(agent);
        try vault.proposeRun(ids, amts, m, sigs) returns (bytes32 k) {
            keys.push(k);
        } catch {}
    }

    function approve(uint256 i) external {
        if (keys.length == 0) return;
        vm.prank(employer);
        try vault.approveRun(keys[i % keys.length]) {} catch {}
    }

    function cancel(uint256 i) external {
        if (keys.length == 0) return;
        vm.prank(employer);
        try vault.cancelRun(keys[i % keys.length]) {} catch {}
    }

    function execute(uint256 i, uint256 skip) external {
        if (keys.length == 0) return;
        vm.warp(block.timestamp + bound(skip, 0, 2 days));
        bytes32 k = keys[i % keys.length];
        PayrollVault.Run memory r = vault.getRun(k);
        vm.prank(employer);
        try vault.executeRun(k) {
            paidOut += r.total;
            for (uint256 j; j < r.payeeIds.length; ++j) {
                timesLinePaid[r.payeeIds[j]][r.memoHash]++;
            }
            executions++;
            timesExecuted[k]++;
        } catch {}
    }

    function keyCount() external view returns (uint256) {
        return keys.length;
    }
}

contract InvariantsTest is Base {
    Handler internal h;

    function setUp() public override {
        super.setUp();
        h = new Handler();
        h.wire(vault, agent, employer, aliceId, bobId);
        targetContract(address(h));
    }

    /// @dev Cumulative payouts stay inside the period cap (the whole test runs inside one 30 day window).
    function invariant_payouts_within_period_cap() public view {
        assertLe(h.paidOut(), 8_000 * USD);
        assertEq(policy.periodSpent(), h.paidOut());
    }

    /// @dev Vault balance falls by exactly what executed runs paid.
    function invariant_balance_matches_payouts() public view {
        assertEq(token.balanceOf(address(vault)), 50_000 * USD - h.paidOut());
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), h.paidOut());
    }

    /// @dev A run executes at most once.
    function invariant_run_executes_once() public view {
        uint256 n = h.keyCount();
        for (uint256 i; i < n; ++i) {
            assertLe(h.timesExecuted(h.keys(i)), 1);
        }
    }

    /// @dev A payee is never paid twice for the same period (memoHash), whichever runs carried the line.
    function invariant_line_paid_at_most_once() public view {
        for (uint256 i; i < 4; ++i) {
            bytes32 m = h.memoAt(i);
            assertLe(h.timesLinePaid(aliceId, m), 1);
            assertLe(h.timesLinePaid(bobId, m), 1);
            assertEq(vault.paidLine(aliceId, m), h.timesLinePaid(aliceId, m) == 1);
            assertEq(vault.paidLine(bobId, m), h.timesLinePaid(bobId, m) == 1);
        }
    }
}
