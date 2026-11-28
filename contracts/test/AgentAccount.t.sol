// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Base} from "./Base.t.sol";
import {AgentAccount} from "../src/AgentAccount.sol";
import {AgentAccountFactory} from "../src/AgentAccountFactory.sol";
import {AgentSpendPolicy} from "../src/AgentSpendPolicy.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {IEntryPointV07, PackedUserOperation} from "../src/interfaces/IEntryPointV07.sol";

/// @dev Runs against the canonical EntryPoint v0.7 bytecode (identical on Ethereum mainnet and Aevum),
/// placed at its real address. The agent's key is a session key on an employer-owned smart account.
contract AgentAccountTest is Base {
    IEntryPointV07 internal constant EP = IEntryPointV07(0x0000000071727De22E5E9d8BAf0edAc6f37da032);

    // EntryPoint v0.7 errors and events (from the ERC-4337 reference interface).
    error FailedOp(uint256 opIndex, string reason);

    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );

    uint256 internal constant EMPLOYER_KEY = uint256(keccak256("employer")); // the key behind makeAddr("employer")
    uint256 internal constant SESSION_KEY = uint256(keccak256("agent-session"));
    address internal session = vm.addr(SESSION_KEY);
    address payable internal bundler = payable(makeAddr("bundler"));

    AgentAccountFactory internal accountFactory;
    AgentAccount internal acct;
    uint48 internal validUntil;
    uint128 internal constant FEE_CAP = 5 gwei;

    function setUp() public override {
        super.setUp();
        vm.etch(address(EP), vm.parseBytes(vm.readFile("test/fixtures/EntryPointV07.hex")));

        accountFactory = new AgentAccountFactory(EP);
        acct = accountFactory.createAccount(employer, 1);
        validUntil = uint48(block.timestamp + 30 days);

        vm.deal(employer, 10 ether);
        vm.startPrank(employer);
        acct.addDeposit{value: 1 ether}();
        acct.setSessionKey(session, address(vault), validUntil, FEE_CAP);
        // The vault's assistant is now the smart account; the same caps still apply to it.
        policy.setPolicy(
            AgentSpendPolicy.Policy({
                agent: address(acct),
                perRun: 5_000 * USD,
                perPayee: 3_000 * USD,
                periodCap: 8_000 * USD,
                period: 30 days,
                expiry: uint64(block.timestamp + 365 days)
            })
        );
        vm.stopPrank();
    }

    // ------------------------------------------------------------ helpers

    function _proposeData(uint256 a, uint256 b, bytes32 memo) internal view returns (bytes memory) {
        bytes32[] memory ids = _ids(aliceId, bobId);
        uint256[] memory amts = _amts(a, b);
        return abi.encodeCall(PayrollVault.proposeRun, (ids, amts, memo, _sigs(ids, amts, memo)));
    }

    function _exec(address target, uint256 value, bytes memory data) internal pure returns (bytes memory) {
        return abi.encodeCall(AgentAccount.execute, (target, value, data));
    }

    function _op(bytes memory callData, uint256 key) internal view returns (PackedUserOperation memory op) {
        op.sender = address(acct);
        op.nonce = EP.getNonce(address(acct), 0);
        op.callData = callData;
        op.accountGasLimits = bytes32((uint256(200_000) << 128) | 600_000);
        op.preVerificationGas = 60_000;
        op.gasFees = bytes32((uint256(1 gwei) << 128) | 2 gwei);
        op.signature = _signOp(op, key);
    }

    function _signOp(PackedUserOperation memory op, uint256 key) internal view returns (bytes memory) {
        bytes32 h = MessageHashUtils.toEthSignedMessageHash(EP.getUserOpHash(op));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, h);
        return abi.encodePacked(r, s, v);
    }

    function _send(PackedUserOperation memory op) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        EP.handleOps(ops, bundler);
    }

    function _expectRefused(bytes memory callData, uint256 key, string memory reason) internal {
        PackedUserOperation memory op = _op(callData, key);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        vm.expectRevert(abi.encodeWithSelector(FailedOp.selector, 0, reason));
        EP.handleOps(ops, bundler);
    }

    function _runKey(uint256 a, uint256 b, bytes32 memo) internal view returns (bytes32) {
        return keccak256(abi.encode(_ids(aliceId, bobId), _amts(a, b), memo));
    }

    // --------------------------------------------------- the one allowed call

    function test_session_key_proposes_through_entrypoint() public {
        uint256 depositBefore = acct.getDeposit();
        _send(_op(_exec(address(vault), 0, _proposeData(10 * USD, 20 * USD, MEMO)), SESSION_KEY));
        assertEq(uint8(vault.runStatus(_runKey(10 * USD, 20 * USD, MEMO))), uint8(PayrollVault.Status.Proposed));
        assertLt(acct.getDeposit(), depositBefore); // gas came from the account's deposit
        assertGt(bundler.balance, 0); // the relayer was paid back
        assertEq(session.balance, 0); // the session key holds nothing
        assertEq(acct.getNonce(), 1);
    }

    function test_policy_caps_still_apply_to_the_account() public {
        // Over the per-person cap: validation passes (it is a proposeRun), the vault refuses, nothing is drafted.
        PackedUserOperation memory op =
            _op(_exec(address(vault), 0, _proposeData(4_000 * USD, 1 * USD, MEMO)), SESSION_KEY);
        vm.recordLogs();
        _send(op);
        assertEq(uint8(vault.runStatus(_runKey(4_000 * USD, 1 * USD, MEMO))), uint8(PayrollVault.Status.None));
    }

    function test_session_key_still_needs_worker_signatures() public {
        bytes32[] memory ids = _ids(aliceId, bobId);
        uint256[] memory amts = _amts(1 * USD, 1 * USD);
        bytes[] memory sigs = _sigs(ids, amts, MEMO);
        sigs[1] = sigs[0];
        bytes memory data = abi.encodeCall(PayrollVault.proposeRun, (ids, amts, MEMO, sigs));
        _send(_op(_exec(address(vault), 0, data), SESSION_KEY));
        assertEq(uint8(vault.runStatus(_runKey(1 * USD, 1 * USD, MEMO))), uint8(PayrollVault.Status.None));
    }

    // ------------------------------------------------ everything else is refused

    function test_session_key_cannot_approve_or_execute() public {
        _send(_op(_exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY));
        bytes32 key = _runKey(1 * USD, 1 * USD, MEMO);
        _expectRefused(
            _exec(address(vault), 0, abi.encodeCall(PayrollVault.approveRun, (key))),
            SESSION_KEY,
            "AA24 signature error"
        );
        _expectRefused(
            _exec(address(vault), 0, abi.encodeCall(PayrollVault.executeRun, (key))),
            SESSION_KEY,
            "AA24 signature error"
        );
        _expectRefused(
            _exec(address(vault), 0, abi.encodeCall(PayrollVault.cancelRun, (key))), SESSION_KEY, "AA24 signature error"
        );
    }

    function test_session_key_cannot_move_money() public {
        vm.deal(address(acct), 1 ether);
        _expectRefused(
            _exec(address(vault), 0, abi.encodeCall(PayrollVault.withdraw, (session, 1))),
            SESSION_KEY,
            "AA24 signature error"
        );
        _expectRefused(
            _exec(address(token), 0, abi.encodeWithSignature("transfer(address,uint256)", session, 1)),
            SESSION_KEY,
            "AA24 signature error"
        );
        _expectRefused(_exec(session, 1 ether, ""), SESSION_KEY, "AA24 signature error");
        _expectRefused(
            _exec(address(acct), 0, abi.encodeCall(AgentAccount.withdrawDepositTo, (payable(session), 1))),
            SESSION_KEY,
            "AA24 signature error"
        );
    }

    function test_session_key_cannot_change_its_own_powers() public {
        _expectRefused(
            _exec(
                address(acct),
                0,
                abi.encodeCall(AgentAccount.setSessionKey, (session, address(vault), type(uint48).max, FEE_CAP))
            ),
            SESSION_KEY,
            "AA24 signature error"
        );
        _expectRefused(
            _exec(address(policy), 0, abi.encodeWithSignature("revoke()")), SESSION_KEY, "AA24 signature error"
        );
    }

    function test_session_key_cannot_use_another_vault_or_send_value() public {
        vm.prank(employer);
        (PayrollVault other,) = factory.createVault(WINDOW);
        _expectRefused(
            _exec(address(other), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY, "AA24 signature error"
        );
        vm.deal(address(acct), 1 ether);
        _expectRefused(
            _exec(address(vault), 1, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY, "AA24 signature error"
        );
    }

    function test_session_key_expires() public {
        vm.warp(uint256(validUntil) + 1);
        _expectRefused(
            _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY, "AA22 expired or not due"
        );
    }

    function test_revoked_session_key_refused() public {
        vm.prank(employer);
        acct.revokeSessionKey();
        assertEq(acct.sessionKey(), address(0));
        assertEq(acct.sessionMaxFeePerGas(), 0);
        _expectRefused(
            _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY, "AA24 signature error"
        );
    }

    function test_unknown_signer_and_bad_signature_refused() public {
        _expectRefused(
            _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)),
            uint256(keccak256("someone-else")),
            "AA24 signature error"
        );
        PackedUserOperation memory op = _op(_exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY);
        op.signature = hex"1234";
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        vm.expectRevert(abi.encodeWithSelector(FailedOp.selector, 0, "AA24 signature error"));
        EP.handleOps(ops, bundler);
    }

    function test_replayed_user_operation_refused() public {
        PackedUserOperation memory op = _op(_exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO)), SESSION_KEY);
        _send(op);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        vm.expectRevert(abi.encodeWithSelector(FailedOp.selector, 0, "AA25 invalid account nonce"));
        EP.handleOps(ops, bundler);
    }

    // --------------------------------------------------------- the owner

    function test_owner_key_can_do_anything_through_entrypoint() public {
        address newKey = makeAddr("new-session");
        _send(
            _op(
                _exec(
                    address(acct),
                    0,
                    abi.encodeCall(AgentAccount.setSessionKey, (newKey, address(vault), validUntil, FEE_CAP))
                ),
                EMPLOYER_KEY
            )
        );
        assertEq(acct.sessionKey(), newKey);
        _send(_op(_exec(address(acct), 0, abi.encodeCall(AgentAccount.revokeSessionKey, ())), EMPLOYER_KEY));
        assertEq(acct.sessionKey(), address(0));
    }

    function test_owner_direct_calls() public {
        vm.deal(address(acct), 1 ether);
        vm.prank(employer);
        acct.execute(stranger, 0.5 ether, "");
        assertEq(stranger.balance, 0.5 ether);

        uint256 before = employer.balance;
        vm.prank(employer);
        acct.withdrawDepositTo(payable(employer), 0.1 ether);
        assertEq(employer.balance, before + 0.1 ether);
    }

    function test_execute_bubbles_revert() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PayrollVault.PayeeNotConfirmed.selector, bytes32(uint256(1))));
        acct.execute(
            address(vault),
            0,
            abi.encodeCall(PayrollVault.proposeRun, (_one(bytes32(uint256(1))), _oneAmt(1), MEMO, new bytes[](1)))
        );
    }

    // ------------------------------------------------------- access rules

    function test_only_owner_or_entrypoint() public {
        vm.prank(session);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.NotOwner.selector, session));
        acct.execute(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        vm.prank(session);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.NotOwner.selector, session));
        acct.setSessionKey(session, address(vault), validUntil, FEE_CAP);
        vm.prank(session);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.NotOwner.selector, session));
        acct.revokeSessionKey();
        vm.prank(session);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.NotOwner.selector, session));
        acct.withdrawDepositTo(payable(session), 1);
    }

    function test_validate_only_from_entrypoint() public {
        PackedUserOperation memory op;
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.NotEntryPoint.selector, address(this)));
        acct.validateUserOp(op, bytes32(0), 0);
    }

    function test_set_session_key_guards() public {
        vm.startPrank(employer);
        vm.expectRevert(AgentAccount.ZeroAddress.selector);
        acct.setSessionKey(address(0), address(vault), validUntil, FEE_CAP);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.InvalidSessionVault.selector, address(0)));
        acct.setSessionKey(session, address(0), validUntil, FEE_CAP);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.InvalidSessionVault.selector, address(acct)));
        acct.setSessionKey(session, address(acct), validUntil, FEE_CAP);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.InvalidExpiry.selector, uint48(block.timestamp)));
        acct.setSessionKey(session, address(vault), uint48(block.timestamp), FEE_CAP);
        vm.expectRevert(AgentAccount.InvalidFeeCap.selector);
        acct.setSessionKey(session, address(vault), validUntil, 0);
        vm.expectRevert(AgentAccount.ZeroAddress.selector);
        acct.withdrawDepositTo(payable(address(0)), 1);
        acct.revokeSessionKey();
        vm.expectRevert(AgentAccount.NoSessionKey.selector);
        acct.revokeSessionKey();
        vm.stopPrank();
    }

    function test_constructor_and_factory_guards() public {
        vm.expectRevert(AgentAccount.ZeroAddress.selector);
        new AgentAccount(EP, address(0));
        vm.expectRevert(AgentAccount.ZeroAddress.selector);
        new AgentAccount(IEntryPointV07(address(0)), employer);
        vm.expectRevert(AgentAccountFactory.ZeroAddress.selector);
        new AgentAccountFactory(IEntryPointV07(address(0)));
    }

    function test_factory_is_deterministic() public {
        assertEq(accountFactory.getAddress(employer, 1), address(acct));
        assertEq(address(accountFactory.createAccount(employer, 1)), address(acct)); // existing account returned
        address predicted = accountFactory.getAddress(stranger, 7);
        assertEq(address(accountFactory.createAccount(stranger, 7)), predicted);
        assertTrue(predicted != address(acct));
        assertEq(acct.owner(), employer);
        assertEq(address(acct.entryPoint()), address(EP));
    }

    function test_receive_and_deposit() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(acct).call{value: 0.2 ether}("");
        assertTrue(ok);
        assertEq(address(acct).balance, 0.2 ether);
    }

    // ------------------------------------------------------- gas limits

    function _withGas(
        bytes memory callData,
        uint256 verGas,
        uint256 callGas,
        uint256 preGas,
        uint256 maxFee,
        uint256 key
    ) internal view returns (PackedUserOperation memory op) {
        op = _op(callData, key);
        op.accountGasLimits = bytes32((verGas << 128) | callGas);
        op.preVerificationGas = preGas;
        op.gasFees = bytes32((uint256(1 gwei) << 128) | maxFee);
        op.signature = _signOp(op, key);
    }

    function _expectOpRefused(PackedUserOperation memory op, string memory reason) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        vm.expectRevert(abi.encodeWithSelector(FailedOp.selector, 0, reason));
        EP.handleOps(ops, bundler);
    }

    function test_session_key_cannot_overpay_for_gas() public {
        bytes memory call = _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        _expectOpRefused(_withGas(call, 200_000, 600_000, 60_000, FEE_CAP + 1, SESSION_KEY), "AA24 signature error");
    }

    function test_session_key_cannot_ask_for_too_much_gas() public {
        bytes memory call = _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        _expectOpRefused(_withGas(call, 200_000, 1_800_000, 60_000, 2 gwei, SESSION_KEY), "AA24 signature error");
    }

    function test_session_key_at_the_limits_is_accepted() public {
        bytes memory call = _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        _send(_withGas(call, 200_000, 1_740_000, 60_000, FEE_CAP, SESSION_KEY));
        assertEq(uint8(vault.runStatus(_runKey(1 * USD, 1 * USD, MEMO))), uint8(PayrollVault.Status.Proposed));
    }

    function test_owner_is_not_bound_by_session_gas_limits() public {
        address newKey = makeAddr("k2");
        _send(
            _withGas(
                _exec(
                    address(acct),
                    0,
                    abi.encodeCall(AgentAccount.setSessionKey, (newKey, address(vault), validUntil, FEE_CAP))
                ),
                200_000,
                2_000_000,
                60_000,
                FEE_CAP * 2,
                EMPLOYER_KEY
            )
        );
        assertEq(acct.sessionKey(), newKey);
    }

    function testFuzz_session_gas_bounded(uint256 callGas, uint256 maxFee) public {
        callGas = bound(callGas, 100_000, 3_000_000);
        maxFee = bound(maxFee, 1 gwei, 20 gwei);
        bytes memory call = _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        PackedUserOperation memory op = _withGas(call, 200_000, callGas, 60_000, maxFee, SESSION_KEY);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        bool allowed = 200_000 + callGas + 60_000 <= acct.MAX_SESSION_GAS() && maxFee <= FEE_CAP;
        vm.prank(bundler, bundler);
        if (!allowed) vm.expectRevert(abi.encodeWithSelector(FailedOp.selector, 0, "AA24 signature error"));
        EP.handleOps(ops, bundler);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_only_proposeRun_on_the_vault_is_a_session_call(address target, uint256 value, bytes4 selector)
        public
        view
    {
        bytes memory inner = abi.encodePacked(selector, uint256(1), uint256(2));
        bool expected = target == address(vault) && value == 0 && selector == PayrollVault.proposeRun.selector;
        assertEq(acct.isSessionCall(_exec(target, value, inner)), expected);
    }

    function testFuzz_random_calldata_is_never_a_session_call(bytes calldata data) public view {
        vm.assume(data.length < 4 || bytes4(data[:4]) != AgentAccount.execute.selector);
        assertFalse(acct.isSessionCall(data));
    }

    function test_session_call_rejects_odd_encodings() public view {
        bytes memory good = _exec(address(vault), 0, _proposeData(1 * USD, 1 * USD, MEMO));
        assertTrue(acct.isSessionCall(good));
        // Too short to hold the header.
        assertFalse(
            acct.isSessionCall(abi.encodePacked(AgentAccount.execute.selector, uint256(uint160(address(vault)))))
        );
        // Non-standard offset for the bytes argument.
        bytes memory odd = abi.encodePacked(
            AgentAccount.execute.selector,
            uint256(uint160(address(vault))),
            uint256(0),
            uint256(0x80),
            uint256(0),
            uint256(4)
        );
        assertFalse(acct.isSessionCall(odd));
        // Declared length longer than the data.
        bytes memory longer = abi.encodePacked(
            AgentAccount.execute.selector, uint256(uint160(address(vault))), uint256(0), uint256(0x60), uint256(64)
        );
        assertFalse(acct.isSessionCall(longer));
        // Inner call shorter than a selector.
        assertFalse(acct.isSessionCall(_exec(address(vault), 0, hex"aabb")));
    }
}
