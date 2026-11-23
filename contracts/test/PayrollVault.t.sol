// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {AgentSpendPolicy} from "../src/AgentSpendPolicy.sol";
import {PayrollVaultFactory} from "../src/PayrollVaultFactory.sol";
import {IIdentityRegistry} from "../src/PayrollVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PayrollVaultTest is Base {
    // ------------------------------------------------------------ funds
    function test_deposit_and_withdraw() public {
        assertEq(token.balanceOf(address(vault)), 50_000 * USD);
        vm.expectEmit(true, false, false, true);
        emit PayrollVault.Withdrawn(employer, 1_000 * USD);
        vm.prank(employer);
        vault.withdraw(employer, 1_000 * USD);
        assertEq(token.balanceOf(address(vault)), 49_000 * USD);
    }

    function test_deposit_zero_reverts() public {
        vm.prank(employer);
        vm.expectRevert(PayrollVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_withdraw_reverts() public {
        vm.startPrank(employer);
        vm.expectRevert(PayrollVault.ZeroAddress.selector);
        vault.withdraw(address(0), 1);
        vm.expectRevert(PayrollVault.ZeroAmount.selector);
        vault.withdraw(employer, 0);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.withdraw(stranger, 1);
    }

    function test_setReviewWindow() public {
        vm.prank(employer);
        vault.setReviewWindow(2 days);
        assertEq(vault.reviewWindow(), 2 days);
        vm.prank(stranger);
        vm.expectRevert();
        vault.setReviewWindow(0);
    }

    function test_constructor_zero_address() public {
        vm.expectRevert(PayrollVault.ZeroAddress.selector);
        new PayrollVault(employer, IERC20(address(0)), policy, IIdentityRegistry(address(0)), 0);
    }

    // ------------------------------------------------------------ payees
    function test_confirm_binds_wallet_and_identity() public view {
        assertEq(vault.payeeWallet(aliceId), alice);
        assertEq(vault.walletPayee(alice), aliceId);
        uint256 idn = vault.payeeIdentityId(aliceId);
        assertEq(registry.ownerOf(idn), alice);
    }

    function test_invite_twice_reverts() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.AlreadyInvited.selector, aliceId));
        vault.invitePayee(aliceId);
    }

    function test_invite_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.invitePayee(keccak256("x"));
    }

    function test_confirm_wrong_name_or_salt_reverts() public {
        bytes32 id = vault.commitmentOf("Carol", keccak256("c"));
        _invite(id);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(PayrollVault.NotInvited.selector, vault.commitmentOf("Carol", keccak256("wrong")))
        );
        vault.confirmPayee("Carol", keccak256("wrong"));
    }

    function test_confirm_twice_reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.AlreadyConfirmed.selector, aliceId));
        vault.confirmPayee("Alice", ALICE_SALT);
    }

    function test_wallet_cannot_bind_two_payees() public {
        bytes32 id = vault.commitmentOf("Alice2", keccak256("a2"));
        _invite(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.WalletAlreadyBound.selector, alice));
        vault.confirmPayee("Alice2", keccak256("a2"));
    }

    function test_revoke_payee_unlinks_and_allows_reconfirm() public {
        vm.prank(employer);
        vault.revokePayee(aliceId);
        assertEq(vault.payeeWallet(aliceId), address(0));
        assertEq(vault.walletPayee(alice), bytes32(0));
        assertTrue(vault.invited(aliceId));

        vm.prank(stranger);
        vault.confirmPayee("Alice", ALICE_SALT);
        assertEq(vault.payeeWallet(aliceId), stranger);
    }

    function test_revoke_payee_emits_event() public {
        vm.expectEmit(true, true, false, false);
        emit PayrollVault.PayeeRevoked(aliceId, alice);
        vm.prank(employer);
        vault.revokePayee(aliceId);
    }

    function test_revoke_payee_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.revokePayee(aliceId);
    }

    function test_revoke_unconfirmed_payee_reverts() public {
        bytes32 id = vault.commitmentOf("Dan", keccak256("d"));
        _invite(id);
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, id));
        vault.revokePayee(id);
    }

    function test_propose_after_revoke_reverts() public {
        vm.prank(employer);
        vault.revokePayee(aliceId);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, aliceId));
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), keccak256("memo"));
    }

    function test_execute_after_revoke_reverts_and_keeps_funds() public {
        bytes32 key = _propose(1_000 * USD, 2_000 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        vault.revokePayee(aliceId);
        vm.stopPrank();
        vm.warp(block.timestamp + WINDOW);
        uint256 before = token.balanceOf(address(vault));
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, aliceId));
        vault.executeRun(key);
        assertEq(token.balanceOf(address(vault)), before);
        assertEq(uint8(vault.runStatus(key)), uint8(PayrollVault.Status.Approved));
    }

    function test_register_agent_identity() public {
        vm.prank(employer);
        uint256 idn = vault.registerAgentIdentity();
        assertEq(registry.ownerOf(idn), agent);
    }

    function test_register_agent_identity_without_agent_reverts() public {
        vm.prank(employer);
        (PayrollVault v,) = factory.createVault(0);
        vm.prank(employer);
        vm.expectRevert(PayrollVault.ZeroAddress.selector);
        v.registerAgentIdentity();
    }

    function test_no_registry_skips_identity() public {
        PayrollVaultFactory f = new PayrollVaultFactory(IERC20(address(token)), IIdentityRegistry(address(0)));
        vm.prank(employer);
        (PayrollVault v,) = f.createVault(0);
        bytes32 id = v.commitmentOf("Zed", bytes32(uint256(1)));
        vm.prank(employer);
        v.invitePayee(id);
        vm.prank(stranger);
        v.confirmPayee("Zed", bytes32(uint256(1)));
        assertEq(v.payeeIdentityId(id), 0);
    }

    // ------------------------------------------------------------ propose
    function test_propose_happy_path() public {
        bytes32 key = _propose(1_000 * USD, 2_000 * USD);
        PayrollVault.Run memory r = vault.getRun(key);
        assertEq(r.total, 3_000 * USD);
        assertEq(uint8(r.status), uint8(PayrollVault.Status.Proposed));
        assertEq(r.executableAt, uint64(block.timestamp) + WINDOW);
    }

    function test_propose_only_agent() public {
        vm.prank(stranger);
        vm.expectRevert(AgentSpendPolicy.NotAgent.selector);
        vault.proposeRun(_one(aliceId), _oneAmt(1), MEMO);
        vm.prank(employer);
        vm.expectRevert(AgentSpendPolicy.NotAgent.selector);
        vault.proposeRun(_one(aliceId), _oneAmt(1), MEMO);
    }

    function test_agent_cannot_approve_cancel_execute() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(agent);
        vm.expectRevert();
        vault.approveRun(key);
        vm.expectRevert();
        vault.cancelRun(key);
        vm.expectRevert();
        vault.executeRun(key);
        vm.expectRevert();
        vault.withdraw(agent, 1);
        vm.stopPrank();
    }

    function test_propose_empty_reverts() public {
        vm.prank(agent);
        vm.expectRevert(PayrollVault.EmptyRun.selector);
        vault.proposeRun(new bytes32[](0), new uint256[](0), MEMO);
    }

    function test_propose_too_many_reverts() public {
        bytes32[] memory ids = new bytes32[](51);
        uint256[] memory a = new uint256[](51);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.TooManyPayees.selector, 51));
        vault.proposeRun(ids, a, MEMO);
    }

    function test_propose_length_mismatch_reverts() public {
        vm.prank(agent);
        vm.expectRevert(PayrollVault.LengthMismatch.selector);
        vault.proposeRun(_ids(aliceId, bobId), _oneAmt(1), MEMO);
    }

    function test_propose_zero_amount_reverts() public {
        vm.prank(agent);
        vm.expectRevert(PayrollVault.ZeroAmount.selector);
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 0), MEMO);
    }

    function test_propose_unconfirmed_payee_reverts() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, ghost));
        vault.proposeRun(_one(ghost), _oneAmt(1 * USD), MEMO);
    }

    function test_propose_invited_but_unconfirmed_reverts() public {
        bytes32 id = vault.commitmentOf("Dan", keccak256("d"));
        _invite(id);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, id));
        vault.proposeRun(_one(id), _oneAmt(1 * USD), MEMO);
    }

    function test_propose_duplicate_payee_reverts() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.DuplicatePayee.selector, aliceId));
        vault.proposeRun(_ids(aliceId, aliceId), _amts(1 * USD, 1 * USD), MEMO);
    }

    function test_propose_duplicate_run_reverts() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.DuplicateRun.selector, key));
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO);
    }

    function test_propose_cap_breaches_revert() public {
        // poisoned timesheet: one payee over perPayee
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentSpendPolicy.PerPayeeCapExceeded.selector, aliceId, 1_000_000 * USD, 3_000 * USD
            )
        );
        vault.proposeRun(_one(aliceId), _oneAmt(1_000_000 * USD), MEMO);
        // total over perRun
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentSpendPolicy.PerRunCapExceeded.selector, 6_000 * USD, 5_000 * USD));
        vault.proposeRun(_ids(aliceId, bobId), _amts(3_000 * USD, 3_000 * USD), MEMO);
    }

    function test_propose_when_paused_reverts() public {
        vm.prank(employer);
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.proposeRun(_one(aliceId), _oneAmt(1), MEMO);
    }

    function test_propose_after_revoke_or_expiry_reverts() public {
        vm.prank(employer);
        policy.revoke();
        vm.prank(agent);
        vm.expectRevert(AgentSpendPolicy.PolicyRevoked.selector);
        vault.proposeRun(_one(aliceId), _oneAmt(1), MEMO);
    }

    function test_propose_after_expiry_reverts() public {
        vm.warp(block.timestamp + 366 days);
        vm.prank(agent);
        vm.expectRevert(AgentSpendPolicy.PolicyExpired.selector);
        vault.proposeRun(_one(aliceId), _oneAmt(1), MEMO);
    }

    // ------------------------------------------------------------ approve / cancel / execute
    function test_full_lifecycle() public {
        bytes32 key = _propose(1_000 * USD, 2_000 * USD);
        vm.prank(employer);
        vault.approveRun(key);
        vm.warp(block.timestamp + WINDOW);
        vm.expectEmit(true, true, true, true);
        emit PayrollVault.PayeePaid(key, aliceId, alice, 1_000 * USD);
        vm.prank(employer);
        vault.executeRun(key);
        assertEq(token.balanceOf(alice), 1_000 * USD);
        assertEq(token.balanceOf(bob), 2_000 * USD);
        assertEq(uint8(vault.runStatus(key)), uint8(PayrollVault.Status.Executed));
        assertEq(policy.periodSpent(), 3_000 * USD);
    }

    function test_execute_twice_reverts() public {
        bytes32 key = _propose(1_000 * USD, 2_000 * USD);
        vm.prank(employer);
        vault.approveRun(key);
        vm.warp(block.timestamp + WINDOW);
        vm.startPrank(employer);
        vault.executeRun(key);
        vm.expectRevert(
            abi.encodeWithSelector(PayrollVault.RunNotApproved.selector, key, PayrollVault.Status.Executed)
        );
        vault.executeRun(key);
        vm.stopPrank();
    }

    function test_execute_inside_review_window_reverts() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        uint64 at = vault.getRun(key).executableAt;
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.ReviewWindowOpen.selector, at));
        vault.executeRun(key);
        vm.stopPrank();
    }

    function test_execute_unapproved_reverts() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.RunNotApproved.selector, key, PayrollVault.Status.Proposed));
        vault.executeRun(key);
    }

    function test_unknown_run_reverts() public {
        bytes32 k = keccak256("nope");
        vm.startPrank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.UnknownRun.selector, k));
        vault.approveRun(k);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.UnknownRun.selector, k));
        vault.cancelRun(k);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.UnknownRun.selector, k));
        vault.executeRun(k);
        vm.stopPrank();
    }

    function test_approve_twice_reverts() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.RunNotProposed.selector, key, PayrollVault.Status.Approved));
        vault.approveRun(key);
        vm.stopPrank();
    }

    function test_cancel_proposed_and_approved() public {
        bytes32 k1 = _propose(1 * USD, 1 * USD);
        vm.prank(employer);
        vault.cancelRun(k1);
        assertEq(uint8(vault.runStatus(k1)), uint8(PayrollVault.Status.Cancelled));

        vm.prank(agent);
        bytes32 k2 = vault.proposeRun(_ids(aliceId, bobId), _amts(2 * USD, 2 * USD), MEMO);
        vm.startPrank(employer);
        vault.approveRun(k2);
        vault.cancelRun(k2);
        vm.stopPrank();
        assertEq(uint8(vault.runStatus(k2)), uint8(PayrollVault.Status.Cancelled));
    }

    function test_cancel_twice_or_executed_reverts() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.cancelRun(key);
        vm.expectRevert(
            abi.encodeWithSelector(PayrollVault.RunNotCancellable.selector, key, PayrollVault.Status.Cancelled)
        );
        vault.cancelRun(key);
        vm.stopPrank();
    }

    function test_cancelled_run_cannot_be_approved_or_reproposed() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.cancelRun(key);
        vm.expectRevert(
            abi.encodeWithSelector(PayrollVault.RunNotProposed.selector, key, PayrollVault.Status.Cancelled)
        );
        vault.approveRun(key);
        vm.stopPrank();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.DuplicateRun.selector, key));
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO);
    }

    function test_pause_blocks_approve_execute_but_not_cancel() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        vault.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.executeRun(key);
        bytes32 k2 = keccak256("x");
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.approveRun(k2);
        vault.cancelRun(key); // still allowed
        vault.unpause();
        vm.stopPrank();
    }

    function test_revoke_after_proposal_blocks_execution() public {
        bytes32 key = _propose(1 * USD, 1 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        policy.revoke();
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(AgentSpendPolicy.PolicyRevoked.selector);
        vault.executeRun(key);
        vm.stopPrank();
    }

    function test_execute_insufficient_balance_reverts() public {
        bytes32 key = _propose(3_000 * USD, 2_000 * USD);
        vm.startPrank(employer);
        vault.approveRun(key);
        vault.withdraw(employer, 48_000 * USD); // leaves 2,000
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.InsufficientBalance.selector, 5_000 * USD, 2_000 * USD));
        vault.executeRun(key);
        vm.stopPrank();
    }

    function test_period_cap_enforced_across_runs_and_resets() public {
        // run 1: 5,000 (perRun cap), run 2: 3,000 -> 8,000 = period cap; run 3 must fail
        bytes32 k1 = _propose(3_000 * USD, 2_000 * USD);
        vm.prank(employer);
        vault.approveRun(k1);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(employer);
        vault.executeRun(k1);

        vm.prank(agent);
        bytes32 k2 = vault.proposeRun(_one(aliceId), _oneAmt(3_000 * USD), keccak256("m2"));
        vm.prank(employer);
        vault.approveRun(k2);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(employer);
        vault.executeRun(k2);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentSpendPolicy.PeriodCapExceeded.selector, 1 * USD, 0));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), keccak256("m3"));

        vm.warp(block.timestamp + 30 days); // window rolls over
        vm.prank(agent);
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), keccak256("m3"));
        assertEq(policy.remainingInPeriod(), 8_000 * USD);
    }

    // ------------------------------------------------------------ factory
    function test_factory_tracks_vaults() public {
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.vaultsOf(employer)[0], address(vault));
        assertEq(address(factory.token()), address(token));
        assertEq(vault.owner(), employer);
        assertEq(policy.owner(), employer);
        assertEq(policy.vault(), address(vault));
    }

    function test_factory_zero_token_reverts() public {
        vm.expectRevert(PayrollVaultFactory.ZeroAddress.selector);
        new PayrollVaultFactory(IERC20(address(0)), IIdentityRegistry(address(registry)));
    }
}
