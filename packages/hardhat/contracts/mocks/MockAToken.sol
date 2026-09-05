//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidityIndex {
    function currentLiquidityIndex(address asset) external view returns (uint256);
}

/**
 * L'aToken finto: il saldo cresce da solo col passare del tempo, come quello vero.
 *
 * Dentro si tiene il saldo "scalato" — quello che non cresce — e il saldo visibile
 * si ottiene moltiplicandolo per l'indice di liquidità del pool. Stesso meccanismo
 * di Aave, ridotto all'osso.
 * @author Oil Company
 */
contract MockAToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 internal constant RAY = 1e27;

    address public immutable pool;
    address public immutable underlying;

    mapping(address => uint256) public scaledBalanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public scaledTotalSupply;

    error OnlyPool();
    error NotEnough();

    modifier onlyPool() {
        if (msg.sender != pool) revert OnlyPool();
        _;
    }

    constructor(address _pool, address _underlying, string memory _name, string memory _symbol, uint8 _decimals) {
        pool = _pool;
        underlying = _underlying;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function _index() internal view returns (uint256) {
        return ILiquidityIndex(pool).currentLiquidityIndex(underlying);
    }

    function balanceOf(address account) public view returns (uint256) {
        return (scaledBalanceOf[account] * _index()) / RAY;
    }

    function totalSupply() public view returns (uint256) {
        return (scaledTotalSupply * _index()) / RAY;
    }

    function mint(address to, uint256 amount) external onlyPool {
        uint256 scaled = (amount * RAY) / _index();
        scaledBalanceOf[to] += scaled;
        scaledTotalSupply += scaled;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyPool {
        uint256 scaled = (amount * RAY) / _index();
        if (scaledBalanceOf[from] < scaled) revert NotEnough();
        scaledBalanceOf[from] -= scaled;
        scaledTotalSupply -= scaled;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert NotEnough();
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 scaled = (amount * RAY) / _index();
        if (scaledBalanceOf[from] < scaled) revert NotEnough();
        scaledBalanceOf[from] -= scaled;
        scaledBalanceOf[to] += scaled;
        emit Transfer(from, to, amount);
    }
}
