// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals

    constructor() ERC20("Mock USD Coin", "USDC") Ownable() {
        // Mint initial supply to deployer (1 million USDC)
        _mint(msg.sender, 1000000 * 10**_decimals);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    // Mint function for testing purposes
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Faucet function for testing - anyone can get 1000 USDC
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**_decimals, "You already have enough USDC");
        _mint(msg.sender, 1000 * 10**_decimals);
    }

    // Burn function for testing
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}