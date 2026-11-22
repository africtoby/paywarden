// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {PayrollVaultFactory} from "../src/PayrollVaultFactory.sol";
import {IIdentityRegistry} from "../src/PayrollVault.sol";

/// @notice Deploys the shared IdentityRegistry and the vault factory.
/// Employer vaults are created later through the factory.
contract Deploy is Script {
    function run() external returns (IdentityRegistry registry, PayrollVaultFactory factory) {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address token = vm.envAddress("TUSD8_ADDRESS");

        vm.startBroadcast(key);
        registry = new IdentityRegistry();
        factory = new PayrollVaultFactory(IERC20(token), IIdentityRegistry(address(registry)));
        vm.stopBroadcast();

        console.log("IdentityRegistry:", address(registry));
        console.log("PayrollVaultFactory:", address(factory));
    }
}
