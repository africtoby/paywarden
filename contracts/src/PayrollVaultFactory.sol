// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentSpendPolicy} from "./AgentSpendPolicy.sol";
import {PayrollVault, IIdentityRegistry} from "./PayrollVault.sol";

/// @title PayrollVaultFactory
/// @notice Deploys one vault plus its spend policy per employer, both owned by the caller.
contract PayrollVaultFactory {
    IERC20 public immutable token;
    IIdentityRegistry public immutable registry;

    mapping(address owner => address[]) private _vaultsOf;
    address[] public allVaults;

    error ZeroAddress();

    event VaultCreated(address indexed owner, address indexed vault, address indexed policy, uint64 reviewWindow);

    constructor(IERC20 token_, IIdentityRegistry registry_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
        registry = registry_;
    }

    function createVault(uint64 reviewWindow) external returns (PayrollVault vault, AgentSpendPolicy policy) {
        policy = new AgentSpendPolicy(msg.sender);
        vault = new PayrollVault(msg.sender, token, policy, registry, reviewWindow);
        policy.bindVault(address(vault));
        _vaultsOf[msg.sender].push(address(vault));
        allVaults.push(address(vault));
        emit VaultCreated(msg.sender, address(vault), address(policy), reviewWindow);
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _vaultsOf[owner];
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}
