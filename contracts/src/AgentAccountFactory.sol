// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentAccount} from "./AgentAccount.sol";
import {IEntryPointV07} from "./interfaces/IEntryPointV07.sol";

/// @title AgentAccountFactory
/// @notice Deploys AgentAccounts with CREATE2, so an employer's account address is known before it exists.
contract AgentAccountFactory {
    IEntryPointV07 public immutable entryPoint;

    error ZeroAddress();

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPointV07 entryPoint_) {
        if (address(entryPoint_) == address(0)) revert ZeroAddress();
        entryPoint = entryPoint_;
    }

    /// @notice Deploys the owner's account for `salt`, or returns it if it already exists.
    function createAccount(address owner, uint256 salt) external returns (AgentAccount account) {
        address predicted = getAddress(owner, salt);
        if (predicted.code.length != 0) return AgentAccount(payable(predicted));
        account = new AgentAccount{salt: _salt(owner, salt)}(entryPoint, owner);
        emit AccountCreated(address(account), owner, salt);
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes32 initHash = keccak256(abi.encodePacked(type(AgentAccount).creationCode, abi.encode(entryPoint, owner)));
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(owner, salt), initHash))))
        );
    }

    function _salt(address owner, uint256 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }
}
