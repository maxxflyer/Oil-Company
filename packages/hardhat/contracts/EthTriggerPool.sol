//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AaveTriggerPool } from "./AaveTriggerPool.sol";
import { BarrelSetup } from "./PoolBase.sol";

interface IExactOutputRouter {
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params) external returns (uint256 amountIn);

    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) external view returns (uint256);
}

interface IWETH {
    function withdraw(uint256 amount) external;

    function approve(address spender, uint256 amount) external returns (bool);
}

interface IRegistryWeth {
    function swapRouter() external view returns (address);

    function weth() external view returns (address);
}

/**
 * Trigger Barrel, sottotipo «chiamata con ETH allegato».
 *
 * La funzione remota vuole dei soldi: un mint, una donazione, il rinnovo di un nome.
 * Il barile però ha token, non ETH. Al momento dello scatto ne compra esattamente
 * quanti gliene servono passando da Uniswap, li srotola da WETH a ETH, e li allega
 * alla chiamata.
 *
 * Quindi uno scatto costa più della sola taglia, e costa una cifra che cambia col
 * prezzo: `extraCost` lo chiede al router ogni volta, e la soglia si sposta con lui.
 * @author Oil Company
 */
contract EthTriggerPool is AaveTriggerPool {
    /// Quanto ETH va allegato alla chiamata. Fissato alla nascita come tutto il resto.
    uint256 public immutable ethValue;

    error NoWeth();
    error NoRouter();

    constructor(
        BarrelSetup memory setup,
        address targetAddress,
        bytes memory targetCall,
        uint256 bountyAmount,
        uint256 ethAmount
    ) AaveTriggerPool(setup, targetAddress, targetCall, bountyAmount) {
        ethValue = ethAmount;
    }

    function flavour() public pure override returns (uint8) {
        return 1;
    }

    /// Quanti token servono, adesso, per comprare l'ETH da allegare.
    function extraCost() public view override returns (uint256) {
        if (ethValue == 0) return 0;
        address router = IRegistryWeth(registry).swapRouter();
        address wethToken = IRegistryWeth(registry).weth();
        if (router == address(0) || wethToken == address(0)) return 0;

        return IExactOutputRouter(router).quoteExactOutputSingle(address(assetToken), wethToken, ethValue);
    }

    function _fire() internal override {
        if (ethValue == 0) {
            _call(0);
            return;
        }

        address router = IRegistryWeth(registry).swapRouter();
        if (router == address(0)) revert NoRouter();
        address wethToken = IRegistryWeth(registry).weth();
        if (wethToken == address(0)) revert NoWeth();

        // In cassa è rimasto quel che serve alla chiamata: taglia e decima sono già uscite.
        uint256 inCassa = assetToken.balanceOf(address(this));
        assetToken.approve(router, inCassa);

        IExactOutputRouter(router).exactOutputSingle(
            IExactOutputRouter.ExactOutputSingleParams({
                tokenIn: address(assetToken),
                tokenOut: wethToken,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: ethValue,
                amountInMaximum: inCassa,
                sqrtPriceLimitX96: 0
            })
        );

        IWETH(wethToken).withdraw(ethValue);
        _call(ethValue);
    }

    /// L'ETH che torna dallo srotolamento del WETH.
    receive() external payable {}
}
