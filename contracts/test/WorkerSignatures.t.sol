// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {MockSmartWallet} from "./MockSmartWallet.sol";
import {PayrollVault} from "../src/PayrollVault.sol";

/// @dev Every pay line must be signed by the payee's confirmed wallet, and a (payee, memo) line pays once.
contract WorkerSignaturesTest is Base {
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function _invalid(bytes32 id) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(PayrollVault.InvalidWorkerSignature.selector, id);
    }

    function _sigsOne(bytes memory sig) internal pure returns (bytes[] memory sigs) {
        sigs = new bytes[](1);
        sigs[0] = sig;
    }

    function _pay(bytes32 key) internal {
        vm.prank(employer);
        vault.approveRun(key);
        vm.warp(block.timestamp + vault.reviewWindow());
        vm.prank(employer);
        vault.executeRun(key);
    }

    // ------------------------------------------------------------- digest

    function test_digest_matches_eip712() public view {
        assertEq(vault.domainSeparator(), _domain(address(vault), block.chainid));
        assertEq(
            vault.payLineDigest(aliceId, 7 * USD, MEMO),
            _digestFor(address(vault), block.chainid, aliceId, 7 * USD, MEMO)
        );
        assertEq(vault.PAYLINE_TYPEHASH(), PAYLINE_TYPEHASH);
    }

    // ---------------------------------------------------------- happy path

    function test_signed_run_pays_and_marks_lines() public {
        vm.prank(agent);
        bytes32 key = _proposeSigned(_ids(aliceId, bobId), _amts(10 * USD, 20 * USD), MEMO);
        assertFalse(vault.paidLine(aliceId, MEMO));
        _pay(key);
        assertEq(token.balanceOf(alice), 10 * USD);
        assertEq(token.balanceOf(bob), 20 * USD);
        assertTrue(vault.paidLine(aliceId, MEMO));
        assertTrue(vault.paidLine(bobId, MEMO));
    }

    function test_next_period_pays_again() public {
        vm.prank(agent);
        _pay(_proposeSigned(_one(aliceId), _oneAmt(10 * USD), MEMO));
        bytes32 next = keccak256("timesheet-2026-12");
        vm.prank(agent);
        _pay(_proposeSigned(_one(aliceId), _oneAmt(10 * USD), next));
        assertEq(token.balanceOf(alice), 20 * USD);
    }

    // ------------------------------------------------------ bad signatures

    function test_wrong_signer_reverts() public {
        bytes memory sig = _signWith(BOB_KEY, _digestFor(address(vault), block.chainid, aliceId, 1 * USD, MEMO));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    function test_inflated_amount_reverts() public {
        bytes memory sig = _sig(aliceId, 1 * USD, MEMO);
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(2 * USD), MEMO, _sigsOne(sig));
    }

    function test_other_memo_reverts() public {
        bytes memory sig = _sig(aliceId, 1 * USD, keccak256("another-period"));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    function test_signature_for_other_vault_reverts() public {
        vm.prank(employer);
        (PayrollVault other,) = factory.createVault(WINDOW);
        bytes memory sig = _signWith(ALICE_KEY, _digestFor(address(other), block.chainid, aliceId, 1 * USD, MEMO));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    function test_signature_for_other_chain_reverts() public {
        bytes memory sig = _signWith(ALICE_KEY, _digestFor(address(vault), block.chainid + 1, aliceId, 1 * USD, MEMO));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    function test_signature_stops_working_after_chain_fork() public {
        bytes memory sig = _sig(aliceId, 1 * USD, MEMO);
        vm.chainId(block.chainid + 7); // domain separator is rebuilt for the new chain id
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    function test_empty_and_short_signatures_revert() public {
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(""));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(hex"1234"));
    }

    function test_one_bad_line_sinks_the_run() public {
        bytes[] memory sigs = _sigs(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO);
        sigs[1] = sigs[0]; // Alice's signature placed on Bob's line
        vm.prank(agent);
        vm.expectRevert(_invalid(bobId));
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO, sigs);
    }

    function test_signatures_length_mismatch_reverts() public {
        vm.prank(agent);
        vm.expectRevert(PayrollVault.LengthMismatch.selector);
        vault.proposeRun(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO, _sigsOne(_sig(aliceId, 1 * USD, MEMO)));
    }

    function test_revoked_payee_with_valid_signature_reverts() public {
        bytes memory sig = _sig(aliceId, 1 * USD, MEMO);
        vm.prank(employer);
        vault.revokePayee(aliceId);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(1 * USD), MEMO, _sigsOne(sig));
    }

    // ---------------------------------------------------- pay a line once

    function test_paid_line_refused_at_propose() public {
        vm.prank(agent);
        _pay(_proposeSigned(_one(aliceId), _oneAmt(1 * USD), MEMO));
        // Same period, a new signature for a different amount: still refused.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.LineAlreadyPaid.selector, aliceId, MEMO));
        _proposeSigned(_one(aliceId), _oneAmt(2 * USD), MEMO);
    }

    function test_paid_line_refused_at_execute() public {
        vm.startPrank(agent);
        bytes32 k1 = _proposeSigned(_ids(aliceId, bobId), _amts(1 * USD, 1 * USD), MEMO);
        bytes32 k2 = _proposeSigned(_one(aliceId), _oneAmt(2 * USD), MEMO);
        vm.stopPrank();
        vm.startPrank(employer);
        vault.approveRun(k1);
        vault.approveRun(k2);
        vm.warp(block.timestamp + vault.reviewWindow());
        vault.executeRun(k1);
        uint256 before = token.balanceOf(address(vault));
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.LineAlreadyPaid.selector, aliceId, MEMO));
        vault.executeRun(k2);
        vm.stopPrank();
        assertEq(token.balanceOf(address(vault)), before);
        assertEq(token.balanceOf(alice), 1 * USD);
        assertEq(uint8(vault.runStatus(k2)), uint8(PayrollVault.Status.Approved));
    }

    // ------------------------------------------------ smart-wallet payees

    function _smartPayee(uint256 ownerKey) internal returns (bytes32 id, MockSmartWallet w) {
        w = new MockSmartWallet(vm.addr(ownerKey));
        id = vault.commitmentOf("Carol", keccak256("carol-salt"));
        _invite(id);
        vm.prank(address(w));
        vault.confirmPayee("Carol", keccak256("carol-salt"));
    }

    function test_erc1271_payee_signs_and_is_paid() public {
        uint256 ownerKey = uint256(keccak256("carol-owner"));
        (bytes32 carolId, MockSmartWallet w) = _smartPayee(ownerKey);
        payeeKey[carolId] = ownerKey;
        vm.prank(agent);
        _pay(_proposeSigned(_one(carolId), _oneAmt(5 * USD), MEMO));
        assertEq(token.balanceOf(address(w)), 5 * USD);
    }

    function test_erc1271_payee_rejects_foreign_signature() public {
        (bytes32 carolId,) = _smartPayee(uint256(keccak256("carol-owner")));
        payeeKey[carolId] = uint256(keccak256("not-the-owner"));
        vm.prank(agent);
        vm.expectRevert(_invalid(carolId));
        _proposeSigned(_one(carolId), _oneAmt(5 * USD), MEMO);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_correct_signature_always_accepted(uint256 amount, bytes32 memo) public {
        amount = bound(amount, 1, 3_000 * USD);
        vm.prank(agent);
        bytes32 key = _proposeSigned(_one(aliceId), _oneAmt(amount), memo);
        assertEq(uint8(vault.runStatus(key)), uint8(PayrollVault.Status.Proposed));
    }

    function testFuzz_any_other_signer_rejected(uint256 key, uint256 amount, bytes32 memo) public {
        key = bound(key, 1, SECP256K1_N - 1);
        vm.assume(key != ALICE_KEY);
        amount = bound(amount, 1, 3_000 * USD);
        bytes memory sig = _signWith(key, _digestFor(address(vault), block.chainid, aliceId, amount, memo));
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(amount), memo, _sigsOne(sig));
    }

    function testFuzz_signed_amount_is_binding(uint256 signed, uint256 proposed) public {
        signed = bound(signed, 1, 3_000 * USD);
        proposed = bound(proposed, 1, 3_000 * USD);
        vm.assume(signed != proposed);
        bytes memory sig = _sig(aliceId, signed, MEMO);
        vm.prank(agent);
        vm.expectRevert(_invalid(aliceId));
        vault.proposeRun(_one(aliceId), _oneAmt(proposed), MEMO, _sigsOne(sig));
    }
}
