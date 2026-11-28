// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentAccountFactory} from "../src/AgentAccountFactory.sol";
import {IEntryPointV07} from "../src/interfaces/IEntryPointV07.sol";

/// @notice Deploys the AgentAccountFactory against the canonical EntryPoint v0.7 (deployed on Aevum).
contract DeployAgentAccount is Script {
    IEntryPointV07 internal constant ENTRY_POINT = IEntryPointV07(0x0000000071727De22E5E9d8BAf0edAc6f37da032);

    function run() external returns (AgentAccountFactory factory) {
        require(address(ENTRY_POINT).code.length != 0, "EntryPoint v0.7 not deployed on this chain");
        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        factory = new AgentAccountFactory(ENTRY_POINT);
        vm.stopBroadcast();
        console.log("AgentAccountFactory:", address(factory));
    }
}
