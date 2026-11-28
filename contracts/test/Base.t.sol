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
    // Same addresses makeAddr("alice") / makeAddr("bob") gave; the keys sign the payees' pay lines.
    uint256 internal constant ALICE_KEY = uint256(keccak256("alice"));
    uint256 internal constant BOB_KEY = uint256(keccak256("bob"));
    address internal alice = vm.addr(ALICE_KEY);
    address internal bob = vm.addr(BOB_KEY);
    address internal stranger = makeAddr("stranger");

    bytes32 internal aliceId;
    bytes32 internal bobId;
    bytes32 internal constant ALICE_SALT = keccak256("alice-salt");
    bytes32 internal constant BOB_SALT = keccak256("bob-salt");
    bytes32 internal constant MEMO = keccak256("timesheet-2026-11");
    bytes32 internal constant PAYLINE_TYPEHASH = keccak256("PayLine(bytes32 payeeId,uint256 amount,bytes32 memoHash)");

    /// @dev Signing key of each confirmed payee's wallet; 0 means "no key" and yields an empty signature.
    mapping(bytes32 payeeId => uint256) internal payeeKey;

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
        payeeKey[aliceId] = ALICE_KEY;
        payeeKey[bobId] = BOB_KEY;
    }

    // ------------------------------------------------------------ signing
    // Digests are built here rather than read from the vault: an external call inside a proposeRun
    // argument list would use up a pending vm.prank / vm.expectRevert.

    function _domain(address v, uint256 chainId) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("PayWarden"),
                keccak256("1"),
                chainId,
                v
            )
        );
    }

    function _digestFor(address v, uint256 chainId, bytes32 id, uint256 amount, bytes32 memo)
        internal
        pure
        returns (bytes32)
    {
        bytes32 structHash = keccak256(abi.encode(PAYLINE_TYPEHASH, id, amount, memo));
        return keccak256(abi.encodePacked(hex"1901", _domain(v, chainId), structHash));
    }

    function _signWith(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sig(bytes32 id, uint256 amount, bytes32 memo) internal view returns (bytes memory) {
        uint256 key = payeeKey[id];
        if (key == 0) return "";
        return _signWith(key, _digestFor(address(vault), block.chainid, id, amount, memo));
    }

    /// @dev One signature per payee id; a missing amount (length-mismatch tests) signs 0.
    function _sigs(bytes32[] memory ids, uint256[] memory amts, bytes32 memo)
        internal
        view
        returns (bytes[] memory sigs)
    {
        sigs = new bytes[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            sigs[i] = _sig(ids[i], i < amts.length ? amts[i] : 0, memo);
        }
    }

    /// @dev proposeRun with every line signed by its payee.
    function _proposeSigned(bytes32[] memory ids, uint256[] memory amts, bytes32 memo) internal returns (bytes32) {
        return vault.proposeRun(ids, amts, memo, _sigs(ids, amts, memo));
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
        key = _proposeSigned(_ids(aliceId, bobId), _amts(a, b), MEMO);
    }
}
