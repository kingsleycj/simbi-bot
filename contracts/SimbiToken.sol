// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimbiToken is ERC20, Ownable {
    constructor() ERC20("Simbi Token", "SIMBI") Ownable(msg.sender) {
        // Initial supply can be minted by owner
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
