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

    function setUp() public override {}

    function wire(PayrollVault v, address agent_, address employer_, bytes32 a, bytes32 b) external {
        vault = v;
        agent = agent_;
        employer = employer_;
        aliceId = a;
        bobId = b;
    }

    function propose(uint256 x, uint256 y, uint256 memo) external {
        x = bound(x, 1, 4_000 * USD);
        y = bound(y, 1, 4_000 * USD);
        vm.prank(agent);
        try vault.proposeRun(_ids(aliceId, bobId), _amts(x, y), bytes32(memo)) returns (bytes32 k) {
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
        uint256 total = vault.getRun(k).total;
        vm.prank(employer);
        try vault.executeRun(k) {
            paidOut += total;
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
}
