// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title IdentityRegistry
/// @notice Minimal ERC-8004 style identity registry: each identity is an ERC-721 token with an
///         optional URI and key/value metadata. Function and event names follow the reference
///         IdentityRegistry at github.com/erc-8004/erc-8004-contracts (MIT). This is an
///         independent, non-upgradeable implementation of the same surface (no agent-wallet signing).
contract IdentityRegistry is ERC721URIStorage {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    error NotAuthorized();
    error EmptyMetadataKey();

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    constructor() ERC721("PayWarden Agent Identity", "PWID") {}

    function register() external returns (uint256) {
        return _register("", new MetadataEntry[](0));
    }

    function register(string calldata agentURI) external returns (uint256) {
        return _register(agentURI, new MetadataEntry[](0));
    }

    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256) {
        return _register(agentURI, metadata);
    }

    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory) {
        _requireOwned(agentId);
        return _metadata[agentId][key];
    }

    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external {
        _requireAuth(agentId);
        _setMetadata(agentId, key, value);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireAuth(agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function isAuthorizedOrOwner(address spender, uint256 agentId) public view returns (bool) {
        address owner_ = ownerOf(agentId);
        return spender == owner_ || isApprovedForAll(owner_, spender) || getApproved(agentId) == spender;
    }

    function _requireAuth(uint256 agentId) internal view {
        if (!isAuthorizedOrOwner(msg.sender, agentId)) revert NotAuthorized();
    }

    function _register(string memory agentURI, MetadataEntry[] memory metadata) internal returns (uint256 agentId) {
        agentId = nextAgentId++;
        _mint(msg.sender, agentId); // plain mint: vault contracts register without an ERC721 receiver hook
        if (bytes(agentURI).length != 0) _setTokenURI(agentId, agentURI);
        for (uint256 i; i < metadata.length; ++i) {
            _setMetadata(agentId, metadata[i].metadataKey, metadata[i].metadataValue);
        }
        emit Registered(agentId, agentURI, msg.sender);
    }

    function _setMetadata(uint256 agentId, string memory key, bytes memory value) internal {
        if (bytes(key).length == 0) revert EmptyMetadataKey();
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }
}
