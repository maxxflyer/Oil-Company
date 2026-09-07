//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { BarrelSetup, PoolBase, PoolKind } from "./PoolBase.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface ISwapRouter {
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

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

interface IRegistry {
    function swapRouter() external view returns (address);

    function isPool(address candidate) external view returns (bool);
}

interface IShareNFT {
    function mint(address to) external returns (uint256);
}

interface IContributable {
    function asset() external view returns (address);

    function contribute(uint256 amount) external;

    function receiveForeign(address token, uint256 amount) external;
}

/**
 * Il motore comune a tutti i barili che lavorano su Aave.
 *
 * Chi versa riceve in cambio una quota — questo contratto è esso stesso un token ERC20,
 * e il token È la quota: si può girare a qualcun altro e la quota va con lui.
 *
 * Le quote guardano solo il **capitale** (`principal`), mai il surplus: chi versa cento
 * riceve la stessa quota che riceverebbe il primo giorno, senza pagare gli interessi
 * maturati da chi è arrivato prima. Per la stessa ragione chi riprende porta via la sua
 * fetta di capitale, non di interessi.
 *
 * Quello che c'è dentro oltre il capitale è il **surplus**: l'interesse maturato in Aave.
 * Non è di chi ha versato. Cosa se ne fa, lo decide il tipo di barile: chi eredita da qui
 * riempie quel buco. Di ogni uscita l'1% va al Prime Barrel: la decima della compagnia.
 * @author Oil Company
 */
abstract contract AaveBarrel is PoolBase, ERC20 {
    /// Un centesimo del surplus, in millesimi.
    uint256 public constant TITHE_BPS = 100;
    uint256 internal constant BPS = 10_000;

    IERC20Metadata public immutable assetToken;
    IAavePool public immutable aave;
    IERC20Metadata public immutable aToken;
    /// Il barile che incassa la decima. Zero se questo è il Prime Barrel: a sé non si paga.
    address public immutable primeBarrel;

    /// Il capitale versato, al netto di quello ripreso. Gli interessi non contano.
    uint256 public principal;
    /// Decime arrivate mentre il barile era senza quote: entrano appena qualcuno ne ha.
    uint256 public pending;

    /// Il titolo che il barile consegna a chi versa. Zero se questo barile non ne dà.
    address public shareNft;
    /// Quanto bisogna versare per averne uno.
    uint256 public shareNftEvery;
    /// Quanto ha versato ciascuno, in tutto, e quanti titoli ha già ricevuto.
    mapping(address => uint256) public depositedBy;
    mapping(address => uint256) public sharesMintedFor;

    /// I token che non sono i suoi e che sa di avere in cassa. Un contratto non può
    /// scoprirlo da sé: glielo dice chi glieli manda, o chi se ne accorge.
    address[] public foreignTokens;
    mapping(address => bool) public knowsForeign;

    uint8 private immutable _decimals;

    event Deposited(address indexed account, uint256 assets, uint256 shares);
    event Withdrawn(address indexed account, uint256 shares, uint256 assets);
    event Contributed(address indexed from, uint256 amount);
    event ContributionSettled(uint256 amount);
    event ShareNftSet(address indexed nft, uint256 every);
    event ShareMinted(address indexed to, uint256 tokenId);

    event ForeignConverted(address indexed token, uint256 amountIn, uint256 amountOut);
    event ForeignReceived(address indexed token, address indexed from, uint256 amount);
    event ForeignNoted(address indexed token, uint256 amount);

    error NothingToMove();
    error NoSwapRouter();
    error NotForeign(address token);
    error LengthMismatch();
    error NotABarrel(address caller);
    error OnlyRegistry();
    error ShareNftAlreadySet();
    error NothingThere(address token);

    constructor(
        BarrelSetup memory setup,
        PoolKind poolKind
    ) PoolBase(setup.creator, poolKind, setup.registry) ERC20(setup.name, "BARREL") {
        assetToken = IERC20Metadata(setup.asset);
        aave = IAavePool(setup.aave);
        aToken = IERC20Metadata(setup.aToken);
        primeBarrel = setup.primeBarrel;
        _decimals = IERC20Metadata(setup.asset).decimals();
    }

    function name() public view override(PoolBase, ERC20) returns (string memory) {
        return ERC20.name();
    }

    /// Il token su cui il barile lavora. Serve anche a chi gli manda la decima.
    function asset() public view returns (address) {
        return address(assetToken);
    }

    /// Le quote si contano come si conta il token che c'è dietro.
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// Quanto vale il barile adesso: gli aToken in cassa, interessi maturati compresi.
    function totalAssets() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    /// Quello che c'è oltre il capitale versato: l'interesse maturato in Aave.
    function surplus() public view returns (uint256) {
        uint256 dentro = totalAssets();
        return dentro > principal ? dentro - principal : 0;
    }

    /// Quanto capitale rappresentano le quote di un indirizzo.
    function assetsOf(address account) public view returns (uint256) {
        uint256 shares = totalSupply();
        if (shares == 0) return 0;
        return (balanceOf(account) * principal) / shares;
    }

    /**
     * Attacca al barile il titolo che consegnerà a chi versa. Lo dice il registro, una
     * volta sola: il contratto del titolo deve nascere dopo il barile, perché deve
     * sapere chi è l'unico che può coniarne.
     */
    function setShareNft(address nft, uint256 every) external {
        if (msg.sender != registry) revert OnlyRegistry();
        if (shareNft != address(0)) revert ShareNftAlreadySet();

        shareNft = nft;
        shareNftEvery = every;
        emit ShareNftSet(nft, every);
    }

    /// Quanto manca a chi versa per meritarsi il titolo successivo.
    function toNextShare(address account) external view returns (uint256) {
        if (shareNft == address(0) || shareNftEvery == 0) return 0;
        uint256 versato = depositedBy[account];
        return shareNftEvery - (versato % shareNftEvery);
    }

    /// I token estranei che il barile sa di avere.
    function foreignTokensList() external view returns (address[] memory) {
        return foreignTokens;
    }

    function foreignTokensCount() external view returns (uint256) {
        return foreignTokens.length;
    }

    /**
     * La decima di un barile che lavora su un'altra moneta. Chi la manda si annuncia,
     * così questo barile sa di averla: un `transfer` e basta non lascerebbe traccia,
     * e il token resterebbe in cassa senza che nessuno lo sappia.
     */
    function receiveForeign(address token, uint256 amount) external {
        if (!IRegistry(registry).isPool(msg.sender)) revert NotABarrel(msg.sender);
        if (token == address(assetToken)) revert NotForeign(token);
        if (amount == 0) revert NothingToMove();

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _noteForeign(token);

        emit ForeignReceived(token, msg.sender, amount);
    }

    /**
     * Segnala al barile un token arrivato per vie traverse — mandato a mano, per dire.
     * Chiunque può farlo: serve solo a metterlo nell'elenco di quelli da cambiare.
     */
    function noteForeign(address token) external {
        if (token == address(assetToken)) revert NotForeign(token);
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) revert NothingThere(token);

        _noteForeign(token);
        emit ForeignNoted(token, amount);
    }

    function _noteForeign(address token) internal {
        if (knowsForeign[token]) return;
        knowsForeign[token] = true;
        foreignTokens.push(token);
    }

    /// Quanto di un token estraneo è fermo in cassa, in attesa di essere convertito.
    function foreignBalanceOf(address token) external view returns (uint256) {
        if (token == address(assetToken)) return 0;
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * Versa nel barile. Va dritto in Aave; in cambio arrivano le quote.
     * Chi versa deve prima autorizzare questo contratto a prendere i suoi token.
     */
    function deposit(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert NothingToMove();

        uint256 principalBefore = principal;
        uint256 sharesBefore = totalSupply();

        assetToken.transferFrom(msg.sender, address(this), assets);
        _supply(assets);

        // Le quote si contano sul capitale, non su quanto vale il barile: il surplus
        // è di qualcun altro e non deve far pagare di più chi arriva dopo.
        shares = sharesBefore == 0 || principalBefore == 0 ? assets : (assets * sharesBefore) / principalBefore;
        _mint(msg.sender, shares);
        principal += assets;

        depositedBy[msg.sender] += assets;
        _mintShares(msg.sender);

        emit Deposited(msg.sender, assets, shares);
        _settlePending();
    }

    /**
     * Denaro che entra senza chiedere quote in cambio: la decima degli altri barili.
     * Vale come capitale, quindi ogni quota già esistente vale un po' di più.
     */
    function contribute(uint256 amount) external {
        if (amount == 0) revert NothingToMove();
        assetToken.transferFrom(msg.sender, address(this), amount);
        pending += amount;
        emit Contributed(msg.sender, amount);
        _settlePending();
    }

    /**
     * Prende i token estranei fermi in cassa — le decime arrivate in una moneta che non
     * è la sua — e li passa da Uniswap per farne il token del barile. Quello che torna
     * entra come capitale, non come surplus: è denaro degli investitori.
     *
     * `minOuts` dice quanto si accetta di ricevere al minimo per ciascuno: serve a non
     * farsi cambiare male. Zero vuol dire «qualunque cifra», e in un mercato vero non
     * si fa.
     */
    function convertForeign(address[] calldata tokens, uint256[] calldata minOuts) external returns (uint256 gained) {
        if (tokens.length != minOuts.length) revert LengthMismatch();

        address router = IRegistry(registry).swapRouter();
        if (router == address(0)) revert NoSwapRouter();

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(assetToken)) revert NotForeign(token);

            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount == 0) continue;

            IERC20(token).approve(router, amount);
            uint256 got = ISwapRouter(router).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: token,
                    tokenOut: address(assetToken),
                    fee: 3000,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amount,
                    amountOutMinimum: minOuts[i],
                    sqrtPriceLimitX96: 0
                })
            );

            gained += got;
            emit ForeignConverted(token, amount, got);
        }

        if (gained == 0) revert NothingToMove();

        pending += gained;
        _settlePending();
    }

    /**
     * Consegna i titoli maturati: uno ogni `shareNftEvery` versati, contati su tutto
     * quello che quell'indirizzo ha messo dentro da sempre.
     */
    function _mintShares(address account) internal {
        if (shareNft == address(0) || shareNftEvery == 0) return;

        uint256 dovuti = depositedBy[account] / shareNftEvery;
        uint256 avuti = sharesMintedFor[account];
        if (dovuti <= avuti) return;

        sharesMintedFor[account] = dovuti;
        for (uint256 i = avuti; i < dovuti; i++) {
            emit ShareMinted(account, IShareNFT(shareNft).mint(account));
        }
    }

    /**
     * Tira fuori da Aave quello che serve, tolto dal surplus, e ne manda l'1% al Prime
     * Barrel. Torna quanto resta in cassa, già pagata la decima.
     *
     * È il gesto comune a ogni barile che spende: cambia solo cosa ci fa dopo.
     */
    function _takeFromSurplus(uint256 amount) internal returns (uint256 netto, uint256 tithe) {
        uint256 preso = _fromAave(amount);
        tithe = _titheOn(preso);
        _payTithe(tithe);
        netto = preso - tithe;
    }

    /// Quanto spetta al Prime Barrel su una certa uscita. Zero se questo è il Prime.
    function _titheOn(uint256 amount) internal view returns (uint256) {
        return primeBarrel == address(0) ? 0 : (amount * TITHE_BPS) / BPS;
    }

    /// Riprende dal deposito in Aave e se li tiene in casa.
    function _fromAave(uint256 amount) internal returns (uint256) {
        return aave.withdraw(address(assetToken), amount, address(this));
    }

    /// Manda la decima al Prime Barrel, annunciandosi se la moneta non è la sua.
    function _payTithe(uint256 tithe) internal {
        if (tithe == 0) return;

        assetToken.approve(primeBarrel, tithe);
        if (IContributable(primeBarrel).asset() == address(assetToken)) {
            IContributable(primeBarrel).contribute(tithe);
        } else {
            // Moneta diversa: il Prime Barrel deve sapere che gli è arrivata.
            IContributable(primeBarrel).receiveForeign(address(assetToken), tithe);
        }
    }

    function _supply(uint256 amount) internal {
        assetToken.approve(address(aave), amount);
        aave.supply(address(assetToken), amount, address(this), 0);
    }

    /**
     * Le decime arrivate quando non c'era nessuna quota resterebbero di nessuno, e il
     * primo che versasse se le prenderebbe tutte. Aspettano qui, ed entrano nel capitale
     * appena una quota esiste.
     */
    function _settlePending() internal {
        if (pending == 0 || totalSupply() == 0) return;

        uint256 amount = pending;
        pending = 0;
        _supply(amount);
        principal += amount;

        emit ContributionSettled(amount);
    }
}
