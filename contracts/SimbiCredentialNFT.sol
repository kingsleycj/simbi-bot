// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimbiCredentialNFT is ERC721, Ownable {
    uint256 private _tokenIds;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("Simbi Credential", "SCRED") Ownable(msg.sender) {}

    function safeMint(address to, string memory uri) public onlyOwner {
        _tokenIds++;
        uint256 tokenId = _tokenIds;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // Override transfer functions to make token soulbound (non-transferable)
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        require(auth == address(0), "Token is soulbound and non-transferable");
        return super._update(to, tokenId, auth);
    }

    // Disable approvals
    function approve(address to, uint256 tokenId) public virtual override {
        revert("Token is soulbound and non-transferable");
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        revert("Token is soulbound and non-transferable");
    }

    function _setTokenURI(uint256 tokenId, string memory uri) internal virtual {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _tokenURIs[tokenId];
    }
}
