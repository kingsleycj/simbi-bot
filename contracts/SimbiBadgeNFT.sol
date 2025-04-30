// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SimbiBadgeNFT is ERC721, Ownable {
    using Strings for uint256;
    
    enum BadgeTier { Bronze, Silver, Gold }

    uint256 private _tokenIds;
    mapping(uint256 => BadgeTier) private _badgeTiers;
    mapping(uint256 => string) private _tokenURIs;
    mapping(BadgeTier => string) private _tierBaseURIs;
    mapping(address => uint256) private _bronzeAttempts;
    mapping(address => uint256) private _silverAttempts;
    mapping(address => uint256) private _goldAttempts;

    constructor() ERC721("Simbi Badge", "SBADGE") Ownable(msg.sender) {
        // Initialize default IPFS URIs for each tier
        _tierBaseURIs[BadgeTier.Bronze] = "ipfs://bafybeia3pzhkdikp7rs66pf6g3rgew4o6vxhbhpfvaizasm4gwpvtnxuui/";
        _tierBaseURIs[BadgeTier.Silver] = "ipfs://bafybeickakjb4ic4emzjvxscapwp3uq5mq4wtrn6hsjjjkb4nkriiiea7e/";
        _tierBaseURIs[BadgeTier.Gold] = "ipfs://bafybeihawam5yalhebqwiybxtbcr42aoqwxa4ypwftb6pb5khw7y5kimhi/";
    }

    function setTierBaseURI(BadgeTier tier, string memory baseURI) public onlyOwner {
        require(bytes(baseURI).length > 0, "URI cannot be empty");
        require(keccak256(bytes(baseURI)) != keccak256(bytes("")), "URI cannot be empty");
        require(keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")), "URI must include IPFS hash");
        _tierBaseURIs[tier] = baseURI;
    }

    function getTierBaseURI(BadgeTier tier) public view returns (string memory) {
        return _tierBaseURIs[tier];
    }

    function recordQuizAttempt(address user, uint256 score) external onlyOwner {
        if (score >= 50) _bronzeAttempts[user]++;
        if (score >= 70) _silverAttempts[user]++;
        if (score == 100) _goldAttempts[user]++;
    }

    function getEligibleTier(address user) public view returns (BadgeTier) {
        if (_goldAttempts[user] >= 70) return BadgeTier.Gold;
        if (_silverAttempts[user] >= 50) return BadgeTier.Silver;
        if (_bronzeAttempts[user] >= 20) return BadgeTier.Bronze;
        revert("No eligible tier");
    }

    function safeMint(address to, BadgeTier tier) public onlyOwner {
        // Check eligibility based on attempts
        if (tier == BadgeTier.Bronze) {
            require(_bronzeAttempts[to] >= 20, "Not eligible for Bronze");
        } else if (tier == BadgeTier.Silver) {
            require(_silverAttempts[to] >= 50, "Not eligible for Silver");
        } else if (tier == BadgeTier.Gold) {
            require(_goldAttempts[to] >= 70, "Not eligible for Gold");
        }

        _tokenIds++;
        uint256 tokenId = _tokenIds;
        _safeMint(to, tokenId);
        _badgeTiers[tokenId] = tier;
        _setTokenURI(tokenId, _tierBaseURIs[tier]);
    }

    function getBadgeTier(uint256 tokenId) external view returns (BadgeTier) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _badgeTiers[tokenId];
    }

    function _setTokenURI(uint256 tokenId, string memory baseURI) internal virtual {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        _tokenURIs[tokenId] = string.concat(baseURI, tokenId.toString(), ".json");
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _tokenURIs[tokenId];
    }

    // Get attempt counts for a user
    function getAttemptCounts(address user) external view returns (uint256 bronze, uint256 silver, uint256 gold) {
        return (_bronzeAttempts[user], _silverAttempts[user], _goldAttempts[user]);
    }
}
