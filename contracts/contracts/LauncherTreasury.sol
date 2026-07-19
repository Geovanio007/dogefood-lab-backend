// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LauncherTreasury
 * @dev Collects DogeFood Lab's share of every fee the launcher generates:
 * the full 2% bonding-curve fee before a token graduates, the 1% protocol
 * half of the swap fee after graduation (paid in-kind, in whatever token
 * traded), and game payments routed through GamePaymentGateway (DOGE, LAB,
 * or any graduated token). It never needs to know which of those a given
 * deposit came from - it just holds native DOGE and ERC20 balances and lets
 * the owner withdraw them. Lab Surge payouts and any other "send funds back
 * out" flow are also just owner withdrawals from here, rather than a
 * separate escrow contract.
 */
contract LauncherTreasury is Ownable {
    event NativeReceived(address indexed from, uint256 amount);
    event NativeWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address owner_) Ownable(owner_) {}

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "LauncherTreasury: bad recipient");
        require(amount <= address(this).balance, "LauncherTreasury: insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "LauncherTreasury: transfer failed");
        emit NativeWithdrawn(to, amount);
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "LauncherTreasury: bad recipient");
        require(IERC20(token).transfer(to, amount), "LauncherTreasury: transfer failed");
        emit TokenWithdrawn(token, to, amount);
    }
}
