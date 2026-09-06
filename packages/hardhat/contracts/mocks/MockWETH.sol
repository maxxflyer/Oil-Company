//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * WETH finto: un ERC20 che si può riaprire per riavere ETH.
 *
 * Serve ai barili che devono allegare ETH a una chiamata: Uniswap lavora in WETH, e
 * l'ETH vero si ottiene solo srotolandolo. Come il WETH vero ha `deposit` e `withdraw`.
 *
 * Differenza col vero: qui chiunque può coniarne — è un mock, e il router ne conia per
 * pagare gli scambi. Perché `withdraw` funzioni il contratto deve avere ETH in cassa,
 * quindi al deploy gliene si manda un po'.
 * @author Oil Company
 */
contract MockWETH is ERC20 {
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    error NotEnoughEther(uint256 have, uint256 want);

    constructor() ERC20("Mock Wrapped Ether", "WETH") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        if (address(this).balance < amount) revert NotEnoughEther(address(this).balance, amount);

        (bool sent, ) = payable(msg.sender).call{ value: amount }("");
        require(sent, "WETH: send failed");
        emit Withdrawal(msg.sender, amount);
    }

    /// Il router finto ne conia per pagare gli scambi.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// La cassa da cui escono gli ETH degli withdraw.
    receive() external payable {
        deposit();
    }
}
