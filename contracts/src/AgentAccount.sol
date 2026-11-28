// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IAccountV07, IEntryPointV07, PackedUserOperation} from "./interfaces/IEntryPointV07.sol";
import {PayrollVault} from "./PayrollVault.sol";

/// @title AgentAccount
/// @notice ERC-4337 (EntryPoint v0.7) smart account the employer owns and the payroll assistant acts through.
///         The owner's key can do anything. The assistant holds a session key that can do exactly one thing:
///         call proposeRun on one vault, with no value, until `sessionValidUntil` (the EntryPoint enforces the
///         expiry). The key holds no funds and no gas: gas comes from this account's EntryPoint deposit.
///         The vault's AgentSpendPolicy still caps every amount, so the session key is a second, independent layer.
contract AgentAccount is IAccountV07 {
    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    /// @notice Most gas (verification + call + pre-verification) one session-key operation may ask for.
    uint256 public constant MAX_SESSION_GAS = 2_000_000;

    IEntryPointV07 public immutable entryPoint;
    address public immutable owner;

    address public sessionKey;
    address public sessionVault;
    uint48 public sessionValidUntil;
    /// @notice Highest maxFeePerGas a session-key operation may offer. With MAX_SESSION_GAS this bounds what one
    /// operation can take from the gas deposit, so a stolen session key cannot drain it at an inflated price.
    uint128 public sessionMaxFeePerGas;

    error NotEntryPoint(address caller);
    error NotOwner(address caller);
    error ZeroAddress();
    error InvalidSessionVault(address vault);
    error InvalidExpiry(uint48 validUntil);
    error NoSessionKey();
    error InvalidFeeCap();

    event SessionKeySet(address indexed key, address indexed vault, uint48 validUntil, uint128 maxFeePerGas);
    event SessionKeyRevoked(address indexed key);
    event Executed(address indexed target, uint256 value, bytes4 selector);

    constructor(IEntryPointV07 entryPoint_, address owner_) {
        if (address(entryPoint_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        entryPoint = entryPoint_;
        owner = owner_;
    }

    receive() external payable {}

    /// @dev The owner directly, the EntryPoint (after validation), or this account calling itself.
    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner && msg.sender != address(entryPoint)) revert NotOwner(msg.sender);
        _;
    }

    /// @dev Settings change only by the owner directly or by an owner-signed user operation (a self-call via execute).
    modifier onlyOwnerOrSelf() {
        if (msg.sender != owner && msg.sender != address(this)) revert NotOwner(msg.sender);
        _;
    }

    // ---------------------------------------------------------------- 4337

    /// @inheritdoc IAccountV07
    /// @dev Signatures are EIP-191 personal signatures over the userOpHash. A session-key signature is only valid
    /// for execute(sessionVault, 0, proposeRun(...)); its validUntil goes back to the EntryPoint, which rejects
    /// the operation after expiry. Any other signer or call returns SIG_VALIDATION_FAILED.
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint(msg.sender);
        validationData = _validate(userOp, userOpHash);
        if (missingAccountFunds != 0) {
            // The EntryPoint checks the deposit itself; a failed top-up just fails validation there.
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            ok;
        }
    }

    function _validate(PackedUserOperation calldata userOp, bytes32 userOpHash) internal view returns (uint256) {
        (address signer, ECDSA.RecoverError err,) =
            ECDSA.tryRecover(MessageHashUtils.toEthSignedMessageHash(userOpHash), userOp.signature);
        if (err != ECDSA.RecoverError.NoError) return SIG_VALIDATION_FAILED;
        if (signer == owner) return 0;
        address key = sessionKey;
        if (key == address(0) || signer != key) return SIG_VALIDATION_FAILED;
        if (userOp.initCode.length != 0 || !isSessionCall(userOp.callData)) return SIG_VALIDATION_FAILED;
        if (!_sessionGasOk(userOp)) return SIG_VALIDATION_FAILED;
        // validationData = validAfter (0) << 208 | validUntil << 160 | authorizer (0 = valid)
        return uint256(sessionValidUntil) << 160;
    }

    /// @dev Session operations stay under the owner's fee cap and the fixed gas ceiling.
    function _sessionGasOk(PackedUserOperation calldata userOp) internal view returns (bool) {
        uint256 limits = uint256(userOp.accountGasLimits);
        uint256 totalGas = (limits >> 128) + uint128(limits) + userOp.preVerificationGas;
        uint256 maxFeePerGas = uint128(uint256(userOp.gasFees));
        return totalGas <= MAX_SESSION_GAS && maxFeePerGas <= sessionMaxFeePerGas;
    }

    /// @notice True only for execute(sessionVault, 0, <proposeRun calldata>), the one call a session key may make.
    function isSessionCall(bytes calldata callData) public view returns (bool) {
        if (callData.length < 4 || bytes4(callData[:4]) != this.execute.selector) return false;
        // Three static words, then the bytes offset; a non-standard offset is refused rather than interpreted.
        if (callData.length < 4 + 32 * 4) return false;
        (address target, uint256 value) = abi.decode(callData[4:68], (address, uint256));
        if (target != sessionVault || target == address(0) || value != 0) return false;
        if (uint256(bytes32(callData[68:100])) != 0x60) return false;
        uint256 len = uint256(bytes32(callData[100:132]));
        if (len < 4 || callData.length < 132 + len) return false;
        return bytes4(callData[132:136]) == PayrollVault.proposeRun.selector;
    }

    // ------------------------------------------------------------- calls

    /// @notice Runs one call from this account. Callable by the owner or by the EntryPoint after validation.
    function execute(address target, uint256 value, bytes calldata data) external onlyOwnerOrEntryPoint {
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 32), mload(ret))
            }
        }
        emit Executed(target, value, data.length >= 4 ? bytes4(data[:4]) : bytes4(0));
    }

    // ------------------------------------------------------- session key

    /// @notice Gives `key` the right to call proposeRun on `vault` until `validUntil` (a unix time in the future),
    /// paying at most `maxFeePerGas` per unit of gas from this account's deposit.
    function setSessionKey(address key, address vault, uint48 validUntil, uint128 maxFeePerGas)
        external
        onlyOwnerOrSelf
    {
        if (key == address(0)) revert ZeroAddress();
        if (vault == address(0) || vault == address(this)) revert InvalidSessionVault(vault);
        if (validUntil <= block.timestamp) revert InvalidExpiry(validUntil);
        if (maxFeePerGas == 0) revert InvalidFeeCap();
        sessionKey = key;
        sessionVault = vault;
        sessionValidUntil = validUntil;
        sessionMaxFeePerGas = maxFeePerGas;
        emit SessionKeySet(key, vault, validUntil, maxFeePerGas);
    }

    /// @notice Removes the session key at once; its pending user operations fail validation.
    function revokeSessionKey() external onlyOwnerOrSelf {
        address key = sessionKey;
        if (key == address(0)) revert NoSessionKey();
        delete sessionKey;
        delete sessionVault;
        delete sessionValidUntil;
        delete sessionMaxFeePerGas;
        emit SessionKeyRevoked(key);
    }

    // ----------------------------------------------------------- deposit

    /// @notice Adds to this account's EntryPoint deposit, which pays the gas for its user operations.
    function addDeposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdrawDepositTo(address payable to, uint256 amount) external onlyOwnerOrSelf {
        if (to == address(0)) revert ZeroAddress();
        entryPoint.withdrawTo(to, amount);
    }

    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function getNonce() external view returns (uint256) {
        return entryPoint.getNonce(address(this), 0);
    }
}
