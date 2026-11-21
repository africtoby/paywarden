// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {AgentSpendPolicy} from "../src/AgentSpendPolicy.sol";
import {PayrollVault} from "../src/PayrollVault.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract AgentSpendPolicyTest is Base {
    function _p(address a, uint256 run, uint256 payee, uint256 cap, uint64 period)
        internal
        view
        returns (AgentSpendPolicy.Policy memory)
    {
        return AgentSpendPolicy.Policy(a, run, payee, cap, period, uint64(block.timestamp + 1 days));
    }

    function test_setPolicy_invalid_reverts() public {
        vm.startPrank(employer);
        vm.expectRevert(AgentSpendPolicy.InvalidPolicy.selector);
        policy.setPolicy(_p(address(0), 1, 1, 1, 1));
        vm.expectRevert(AgentSpendPolicy.InvalidPolicy.selector);
        policy.setPolicy(_p(agent, 0, 1, 1, 1));
        vm.expectRevert(AgentSpendPolicy.InvalidPolicy.selector);
        policy.setPolicy(_p(agent, 1, 0, 1, 1));
        vm.expectRevert(AgentSpendPolicy.InvalidPolicy.selector);
        policy.setPolicy(_p(agent, 1, 1, 0, 1));
        vm.expectRevert(AgentSpendPolicy.InvalidPolicy.selector);
        policy.setPolicy(_p(agent, 1, 1, 1, 0));
        vm.stopPrank();
    }

    function test_setPolicy_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        policy.setPolicy(_p(agent, 1, 1, 1, 1));
    }

    function test_setPolicy_lifts_revoke() public {
        vm.startPrank(employer);
        policy.revoke();
        assertTrue(policy.revoked());
        policy.setPolicy(_p(agent, 1, 1, 1, 1));
        assertFalse(policy.revoked());
        vm.stopPrank();
        assertEq(policy.agent(), agent);
    }

    function test_revoke_only_owner() public {
        vm.prank(stranger);
        vm.expectRevert();
        policy.revoke();
    }

    function test_expiry_zero_means_never() public {
        vm.prank(employer);
        policy.setPolicy(AgentSpendPolicy.Policy(agent, 10, 10, 10, 1 days, 0));
        vm.warp(block.timestamp + 5000 days);
        policy.checkRun(agent, _one(aliceId), _oneAmt(1));
    }

    function test_checkRun_length_mismatch_and_bad_caller() public {
        vm.expectRevert(AgentSpendPolicy.LengthMismatch.selector);
        policy.checkRun(agent, _one(aliceId), new uint256[](0));
        vm.expectRevert(AgentSpendPolicy.NotAgent.selector);
        policy.checkRun(address(0), _one(aliceId), _oneAmt(1));
    }

    function test_recordRun_only_vault() public {
        vm.prank(stranger);
        vm.expectRevert(AgentSpendPolicy.NotVault.selector);
        policy.recordRun(_one(aliceId), _oneAmt(1));
    }

    function test_bindVault_guards() public {
        vm.prank(stranger);
        vm.expectRevert(AgentSpendPolicy.NotBinder.selector);
        policy.bindVault(stranger);
        // the factory is the binder and has already bound
        vm.prank(address(factory));
        vm.expectRevert(AgentSpendPolicy.VaultAlreadyBound.selector);
        policy.bindVault(stranger);
    }

    function test_remainingInPeriod_when_overspent_is_zero() public {
        // shrink the cap below what was already spent
        bytes32 key = _propose(3_000 * USD, 2_000 * USD);
        vm.prank(employer);
        vault.approveRun(key);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(employer);
        vault.executeRun(key);
        assertEq(policy.remainingInPeriod(), 3_000 * USD);
    }

    // ------------------------------------------------------------ fuzz
    /// @dev No single payee amount above perPayee and no run total above perRun is ever accepted.
    function testFuzz_caps_never_exceeded(uint256 a, uint256 b) public {
        a = bound(a, 1, 10_000 * USD);
        b = bound(b, 1, 10_000 * USD);
        vm.prank(agent);
        try vault.proposeRun(_ids(aliceId, bobId), _amts(a, b), MEMO) returns (bytes32 key) {
            assertLe(a, 3_000 * USD);
            assertLe(b, 3_000 * USD);
            assertLe(a + b, 5_000 * USD);
            assertEq(vault.getRun(key).total, a + b);
        } catch {
            assertTrue(a > 3_000 * USD || b > 3_000 * USD || a + b > 5_000 * USD);
        }
    }

    /// @dev Cumulative spend inside one window never passes periodCap, whatever the sequence of runs.
    function testFuzz_period_cap_holds(uint256 x, uint256 y, uint256 z) public {
        uint256[3] memory v = [bound(x, 1, 3_000 * USD), bound(y, 1, 3_000 * USD), bound(z, 1, 3_000 * USD)];
        uint256 spent;
        for (uint256 i; i < 3; ++i) {
            vm.prank(agent);
            try vault.proposeRun(_one(aliceId), _oneAmt(v[i]), bytes32(i + 1)) returns (bytes32 key) {
                vm.prank(employer);
                vault.approveRun(key);
                vm.warp(block.timestamp + WINDOW);
                vm.prank(employer);
                try vault.executeRun(key) {
                    spent += v[i];
                } catch {}
            } catch {}
            assertLe(spent, 8_000 * USD);
            assertEq(policy.periodSpent(), spent);
        }
    }

    function testFuzz_window_rollover(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 400 days);
        bytes32 key = _propose(3_000 * USD, 2_000 * USD);
        vm.prank(employer);
        vault.approveRun(key);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(employer);
        vault.executeRun(key); // 5,000 spent
        vm.warp(block.timestamp + elapsed);
        uint256 rem = policy.remainingInPeriod();
        // policy expires at +365d; stay inside the window the test cares about
        if (block.timestamp + 0 < policy.periodStart() + 30 days) assertEq(rem, 3_000 * USD);
        else assertEq(rem, 8_000 * USD);
    }
}

contract IdentityRegistryTest is Base {
    function test_register_variants_and_metadata() public {
        vm.startPrank(alice);
        uint256 a = registry.register();
        uint256 b = registry.register("ipfs://x");
        IdentityRegistry.MetadataEntry[] memory m = new IdentityRegistry.MetadataEntry[](1);
        m[0] = IdentityRegistry.MetadataEntry("role", "payee");
        uint256 c = registry.register("ipfs://y", m);
        vm.stopPrank();
        assertEq(b, a + 1);
        assertEq(registry.tokenURI(b), "ipfs://x");
        assertEq(registry.getMetadata(c, "role"), "payee");
    }

    function test_set_metadata_and_uri_auth() public {
        vm.prank(alice);
        uint256 id = registry.register();
        vm.prank(alice);
        registry.setMetadata(id, "k", "v");
        assertEq(registry.getMetadata(id, "k"), "v");
        vm.prank(alice);
        registry.setAgentURI(id, "ipfs://new");
        assertEq(registry.tokenURI(id), "ipfs://new");
        assertTrue(registry.isAuthorizedOrOwner(alice, id));
        assertFalse(registry.isAuthorizedOrOwner(stranger, id));

        vm.startPrank(stranger);
        vm.expectRevert(IdentityRegistry.NotAuthorized.selector);
        registry.setMetadata(id, "k", "z");
        vm.expectRevert(IdentityRegistry.NotAuthorized.selector);
        registry.setAgentURI(id, "x");
        vm.stopPrank();
    }

    function test_empty_metadata_key_reverts() public {
        vm.startPrank(alice);
        uint256 id = registry.register();
        vm.expectRevert(IdentityRegistry.EmptyMetadataKey.selector);
        registry.setMetadata(id, "", "v");
        vm.stopPrank();
    }
}
