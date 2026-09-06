//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { MockERC20 } from "./MockERC20.sol";

/**
 * Uniswap finto, ridotto a quello che serve: si dà un token e se ne riceve un altro.
 *
 * Il prezzo non lo fa un mercato: c'è una tabella, un valore in dollari per ogni token,
 * e il cambio è il rapporto fra i due. Niente slippage, niente commissioni — quello che
 * conta qui è che i decimali tornino e che il pool sappia parlare con un router.
 *
 * La firma è quella del SwapRouter di Uniswap v3, così passare al vero significa
 * cambiare indirizzo.
 * @author Oil Company
 */
contract MockUniswapRouter {
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

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    address public immutable owner;
    /// Quanto vale un token intero, in dollari con diciotto decimali.
    mapping(address => uint256) public priceOf;

    error OnlyOwner();
    error NoPrice(address token);
    error NothingToSwap();
    error TooLittleReceived(uint256 got, uint256 wanted);
    error TooMuchRequested(uint256 needed, uint256 allowed);
    error Expired();

    event PriceSet(address indexed token, uint256 price);
    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor() {
        owner = msg.sender;
    }

    function setPrice(address token, uint256 price) external {
        if (msg.sender != owner) revert OnlyOwner();
        priceOf[token] = price;
        emit PriceSet(token, price);
    }

    /// Quanto si riceverebbe, senza fare niente. Il preventivo che l'interfaccia mostra.
    function quote(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        uint256 priceIn = priceOf[tokenIn];
        uint256 priceOut = priceOf[tokenOut];
        if (priceIn == 0) revert NoPrice(tokenIn);
        if (priceOut == 0) revert NoPrice(tokenOut);

        uint256 unitIn = 10 ** IERC20Metadata(tokenIn).decimals();
        uint256 unitOut = 10 ** IERC20Metadata(tokenOut).decimals();

        return (amountIn * priceIn * unitOut) / (priceOut * unitIn);
    }

    /// Quanto tokenIn serve per averne esattamente amountOut. Il preventivo al contrario.
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) public view returns (uint256) {
        uint256 priceIn = priceOf[tokenIn];
        uint256 priceOut = priceOf[tokenOut];
        if (priceIn == 0) revert NoPrice(tokenIn);
        if (priceOut == 0) revert NoPrice(tokenOut);

        uint256 unitIn = 10 ** IERC20Metadata(tokenIn).decimals();
        uint256 unitOut = 10 ** IERC20Metadata(tokenOut).decimals();

        // Un wei in più: gli arrotondamenti non devono lasciare lo scambio corto.
        return (amountOut * priceOut * unitIn) / (priceIn * unitOut) + 1;
    }

    /// Compra una cifra esatta di tokenOut, spendendo quel che serve fino al massimo dato.
    function exactOutputSingle(ExactOutputSingleParams calldata params) external returns (uint256 amountIn) {
        if (params.deadline != 0 && block.timestamp > params.deadline) revert Expired();
        if (params.amountOut == 0) revert NothingToSwap();

        amountIn = quoteExactOutputSingle(params.tokenIn, params.tokenOut, params.amountOut);
        if (amountIn > params.amountInMaximum) revert TooMuchRequested(amountIn, params.amountInMaximum);

        MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn);
        MockERC20(params.tokenOut).mint(params.recipient, params.amountOut);

        emit Swapped(params.tokenIn, params.tokenOut, amountIn, params.amountOut);
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        if (params.deadline != 0 && block.timestamp > params.deadline) revert Expired();
        if (params.amountIn == 0) revert NothingToSwap();

        amountOut = quote(params.tokenIn, params.tokenOut, params.amountIn);
        if (amountOut < params.amountOutMinimum) revert TooLittleReceived(amountOut, params.amountOutMinimum);

        MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        // È un mock: il token in uscita si conia, non si prende da una riserva.
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);

        emit Swapped(params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }
}
