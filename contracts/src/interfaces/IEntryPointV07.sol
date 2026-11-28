// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev ERC-4337 v0.7 types and the EntryPoint functions PayWarden uses, written from the ERC-4337 spec
/// (eips.ethereum.org/EIPS/eip-4337). The deployed EntryPoint v0.7 lives at 0x0000000071727De22E5E9d8BAf0edAc6f37da032.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits; // verificationGasLimit (high 128 bits) | callGasLimit (low 128 bits)
    uint256 preVerificationGas;
    bytes32 gasFees; // maxPriorityFeePerGas (high 128 bits) | maxFeePerGas (low 128 bits)
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPointV07 {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IAccountV07 {
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}
