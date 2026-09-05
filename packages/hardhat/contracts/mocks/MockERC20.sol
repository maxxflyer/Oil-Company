//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Un token finto, per provare in locale: DAI, WETH, USDC, quello che serve.
 * Chiunque può coniarne: serve a riempirsi il portafoglio senza cercare un rubinetto.
 * @author Oil Company
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals) ERC20(tokenName, tokenSymbol) {
        _decimals = tokenDecimals;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
