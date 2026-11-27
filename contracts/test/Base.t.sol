// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentSpendPolicy} from "../src/AgentSpendPolicy.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {PayrollVault, IIdentityRegistry} from "../src/PayrollVault.sol";
import {PayrollVaultFactory} from "../src/PayrollVaultFactory.sol";

contract MockUSD8 is ERC20 {
    constructor() ERC20("Test USD8", "tUSD8") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract Base is Test {
    uint256 internal constant USD = 1e6; // 1 tUSD8 in raw units (6 dp)
    uint64 internal constant WINDOW = 1 days;

    MockUSD8 internal token;
    IdentityRegistry internal registry;
    PayrollVaultFactory internal factory;
    PayrollVault internal vault;
    AgentSpendPolicy internal policy;

    address internal employer = makeAddr("employer");
    address internal agent = makeAddr("agent");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    bytes32 internal aliceId;
    bytes32 internal bobId;
    bytes32 internal constant ALICE_SALT = keccak256("alice-salt");
    bytes32 internal constant BOB_SALT = keccak256("bob-salt");
    bytes32 internal constant MEMO = keccak256("timesheet-2026-11");

    function setUp() public virtual {
        token = new MockUSD8();
        registry = new IdentityRegistry();
        factory = new PayrollVaultFactory(IERC20(address(token)), IIdentityRegistry(address(registry)));

        vm.prank(employer);
        (vault, policy) = factory.createVault(WINDOW);

        vm.prank(employer);
        policy.setPolicy(
            AgentSpendPolicy.Policy({
                agent: agent,
                perRun: 5_000 * USD,
                perPayee: 3_000 * USD,
                periodCap: 8_000 * USD,
                period: 30 days,
                expiry: uint64(block.timestamp + 365 days)
            })
        );

        token.mint(employer, 100_000 * USD);
        vm.startPrank(employer);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(50_000 * USD);
        vm.stopPrank();

        aliceId = vault.commitmentOf("Alice", ALICE_SALT);
        bobId = vault.commitmentOf("Bob", BOB_SALT);
        _invite(aliceId);
        _invite(bobId);
        vm.prank(alice);
        vault.confirmPayee("Alice", ALICE_SALT);
        vm.prank(bob);
        vault.confirmPayee("Bob", BOB_SALT);
    }

    function _invite(bytes32 id) internal {
        vm.prank(employer);
        vault.invitePayee(id, address(0));
    }

    function _inviteFor(bytes32 id, address wallet) internal {
        vm.prank(employer);
        vault.invitePayee(id, wallet);
    }

    function _ids(bytes32 a, bytes32 b) internal pure returns (bytes32[] memory ids) {
        ids = new bytes32[](2);
        ids[0] = a;
        ids[1] = b;
    }

    function _amts(uint256 a, uint256 b) internal pure returns (uint256[] memory v) {
        v = new uint256[](2);
        v[0] = a;
        v[1] = b;
    }

    function _one(bytes32 a) internal pure returns (bytes32[] memory ids) {
        ids = new bytes32[](1);
        ids[0] = a;
    }

    function _oneAmt(uint256 a) internal pure returns (uint256[] memory v) {
        v = new uint256[](1);
        v[0] = a;
    }

    function _propose(uint256 a, uint256 b) internal returns (bytes32 key) {
        vm.prank(agent);
        key = vault.proposeRun(_ids(aliceId, bobId), _amts(a, b), MEMO);
    }
}
