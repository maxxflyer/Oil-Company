//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MockAToken } from "./MockAToken.sol";
import { MockERC20 } from "./MockERC20.sol";

/**
 * Aave finto, ridotto a quello che serve: si deposita un token e si ricevono aToken,
 * si restituiscono aToken e si riprende il token.
 *
 * Ogni token ha la sua riserva, con il suo aToken e il suo indice di liquidità.
 * L'indice cresce di un tasso fisso al secondo, così gli interessi maturano davvero
 * mentre la catena avanza; i token degli interessi vengono coniati al momento del
 * ritiro, perché è un mock e la cassa non deve tornare.
 *
 * Le firme sono quelle di Aave v3, così passare al vero significa cambiare indirizzo.
 * @author Oil Company
 */
contract MockAavePool {
    struct Reserve {
        MockAToken aToken;
        uint256 liquidityIndex;
        uint256 lastUpdate;
    }

    uint256 internal constant RAY = 1e27;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    address public immutable owner;
    /// Tasso annuo, in ray. 5e25 = 5%.
    uint256 public immutable ratePerYear;

    mapping(address => Reserve) public reserves;
    address[] public listedAssets;

    error OnlyOwner();
    error UnsupportedAsset(address asset);
    error AlreadyListed(address asset);
    error NothingToMove();

    event ReserveListed(address indexed asset, address indexed aToken);
    event Supply(address indexed asset, address indexed onBehalfOf, uint256 amount);
    event Withdraw(address indexed asset, address indexed to, uint256 amount);

    constructor(uint256 _ratePerYear) {
        owner = msg.sender;
        ratePerYear = _ratePerYear;
    }

    /// Apre una riserva per un token: da qui in poi Aave lo accetta.
    function listAsset(address asset) external returns (address) {
        if (msg.sender != owner) revert OnlyOwner();
        if (address(reserves[asset].aToken) != address(0)) revert AlreadyListed(asset);

        MockERC20 token = MockERC20(asset);
        MockAToken aToken = new MockAToken(
            address(this),
            asset,
            string.concat("Mock Aave Interest Bearing ", token.symbol()),
            string.concat("a", token.symbol()),
            token.decimals()
        );
        reserves[asset] = Reserve(aToken, RAY, block.timestamp);
        listedAssets.push(asset);

        emit ReserveListed(asset, address(aToken));
        return address(aToken);
    }

    function aTokenOf(address asset) external view returns (address) {
        return address(reserves[asset].aToken);
    }

    /// Come in Aave v3: l'elenco dei token su cui il protocollo lavora.
    function getReservesList() external view returns (address[] memory) {
        return listedAssets;
    }

    function listedAssetsCount() external view returns (uint256) {
        return listedAssets.length;
    }

    /// L'indice com'è adesso, interessi maturati inclusi — anche senza transazioni di mezzo.
    function currentLiquidityIndex(address asset) public view returns (uint256) {
        Reserve storage reserve = reserves[asset];
        if (address(reserve.aToken) == address(0)) revert UnsupportedAsset(asset);

        uint256 elapsed = block.timestamp - reserve.lastUpdate;
        if (elapsed == 0) return reserve.liquidityIndex;

        uint256 growth = (ratePerYear * elapsed) / SECONDS_PER_YEAR;
        return reserve.liquidityIndex + (reserve.liquidityIndex * growth) / RAY;
    }

    function _accrue(address asset) internal returns (Reserve storage reserve) {
        reserve = reserves[asset];
        reserve.liquidityIndex = currentLiquidityIndex(asset);
        reserve.lastUpdate = block.timestamp;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        if (amount == 0) revert NothingToMove();
        Reserve storage reserve = _accrue(asset);

        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        reserve.aToken.mint(onBehalfOf, amount);

        emit Supply(asset, onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        if (amount == 0) revert NothingToMove();
        Reserve storage reserve = _accrue(asset);

        uint256 available = reserve.aToken.balanceOf(msg.sender);
        uint256 toMove = amount == type(uint256).max || amount > available ? available : amount;
        if (toMove == 0) revert NothingToMove();

        reserve.aToken.burn(msg.sender, toMove);

        // Gli interessi sono denaro che in un mock non esiste: lo si conia al bisogno.
        MockERC20 token = MockERC20(asset);
        uint256 inCassa = token.balanceOf(address(this));
        if (inCassa < toMove) token.mint(address(this), toMove - inCassa);
        token.transfer(to, toMove);

        emit Withdraw(asset, to, toMove);
        return toMove;
    }

    function getReserveNormalizedIncome(address asset) external view returns (uint256) {
        return currentLiquidityIndex(asset);
    }
}
