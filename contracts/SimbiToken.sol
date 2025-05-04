// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimbiToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens with 18 decimals
    uint256 public constant USER_SUPPLY_CAP = (MAX_SUPPLY * 60) / 100; // 60% of total supply
    uint256 public constant CREATOR_SUPPLY = (MAX_SUPPLY * 40) / 100; // 40% of total supply
    
    uint256 private _userMinted;
    string private _tokenImageURI;

    // Add minter role tracking
    mapping(address => bool) public minters;
    
    // Add minter events
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    
    constructor(string memory tokenImageURI) ERC20("Simbi Token", "SIMBI") Ownable(msg.sender) {
        _tokenImageURI = tokenImageURI;
        
        // Mint creator's share (40%) to the deployer
        _mint(msg.sender, CREATOR_SUPPLY);
    }

    // Update mintToUser to allow minters
    function mintToUser(address to, uint256 amount) public {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        require(_userMinted + amount <= USER_SUPPLY_CAP, "Minting would exceed user supply cap");
        _userMinted += amount;
        _mint(to, amount);
    }

    function getUserMinted() public view returns (uint256) {
        return _userMinted;
    }

    function getRemainingUserSupply() public view returns (uint256) {
        return USER_SUPPLY_CAP - _userMinted;
    }
    
    // Function to update token image URI (only owner)
    function setTokenImageURI(string memory newImageURI) public onlyOwner {
        _tokenImageURI = newImageURI;
    }
    
    // Function to get token image URI
    function tokenImageURI() public view returns (string memory) {
        return _tokenImageURI;
    }
    
    // Implement grantMinter function
    function grantMinter(address quizManagerAddress) public onlyOwner {
        require(quizManagerAddress != address(0), "Invalid address");
        require(!minters[quizManagerAddress], "Already a minter");
        minters[quizManagerAddress] = true;
        emit MinterAdded(quizManagerAddress);
    }

    // Add revokeMinter function
    function revokeMinter(address minter) public onlyOwner {
        require(minters[minter], "Not a minter");
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
}
