//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { AaveFundPool } from "./AaveFundPool.sol";
import { AaveTriggerPool } from "./AaveTriggerPool.sol";
import { EthTriggerPool } from "./EthTriggerPool.sol";
import { IFundBarrelFactory, ITriggerBarrelFactory } from "./BarrelFactories.sol";
import { BasicPool } from "./BasicPool.sol";
import { BarrelSetup, PoolBase, PoolKind, TriggerSpec } from "./PoolBase.sol";

/// Quel poco che al registro serve sapere di Aave.
interface IAaveReserves {
    function getReservesList() external view returns (address[] memory);

    function aTokenOf(address asset) external view returns (address);
}

/**
 * Il registro dei barili: ne apre di ogni tipo e tiene l'elenco di quelli aperti.
 * Aprirne uno costa `creationFee`; solo `owner` può cambiare quel prezzo e ritirare
 * quanto incassato.
 *
 * I token su cui si possono aprire barili di tipo 1 non sono una lista del registro:
 * sono le riserve di Aave, chieste ad Aave ogni volta. Se Aave lo accetta, il barile
 * si può aprire.
 * @author Oil Company
 */
contract PoolRegistry {
    struct AssetInfo {
        address token;
        address aToken;
        string symbol;
        uint8 decimals;
    }

    struct PoolInfo {
        address poolAddress;
        string name;
        address creator;
        uint256 creationBlock;
        PoolKind kind;
        /// Il primo barile della compagnia, quello che incassa la decima degli altri.
        bool isPrime;
        /// Da qui in giù ha senso solo per i barili di tipo 1.
        address asset;
        string assetSymbol;
        uint8 assetDecimals;
        address beneficiary;
        /// Il capitale versato, al netto di quello ripreso.
        uint256 principal;
        /// Quanto vale il barile adesso, interessi compresi.
        uint256 totalAssets;
        /// Quello che c'è oltre il capitale: gli interessi maturati.
        uint256 surplus;
        /// Da qui in giù ha senso solo per i barili a grilletto.
        address target;
        uint256 bounty;
        uint256 shotCost;
        uint256 shots;
        uint8 subtype;
        uint256 ethValue;
        /// Il titolo che il barile consegna a chi versa, e ogni quanto.
        address shareNft;
        uint256 shareNftEvery;
    }

    address public owner;
    uint256 public creationFee;
    address public immutable aave;
    /// Il Prime Barrel: raccoglie i soldi degli investitori e l'1% del surplus di tutti.
    address public primeBarrel;
    /// Il router Uniswap con cui i barili cambiano in casa i token che non sono i loro.
    address public swapRouter;
    /// L'ETH avvolto: serve ai barili che devono allegare ETH a una chiamata.
    address public weth;
    /// Il token della compagnia, quello che si riceve finanziandola sul launch pad.
    /// Lo dice il launcher quando mette al mondo il progetto.
    address public crudeToken;
    /// Chi costruisce i barili. Il registro non se li fa in casa: sarebbe troppo grosso.
    address public fundFactory;
    /// Una fabbrica per sottotipo di grilletto: 0 chiamata secca, 1 con ETH allegato.
    mapping(uint8 => address) public triggerFactoryOf;

    address[] public pools;
    mapping(address => bool) public isPool;

    event PoolCreated(
        address indexed poolAddress,
        address indexed creator,
        string name,
        uint256 creationBlock,
        PoolKind kind,
        address asset,
        address beneficiary
    );
    event CreationFeeChanged(uint256 previousFee, uint256 newFee);
    event PrimeBarrelOpened(address indexed poolAddress, address indexed asset, address indexed beneficiary);
    event TriggerBarrelOpened(address indexed poolAddress, address indexed target, uint256 bounty);
    event SwapRouterChanged(address indexed router);
    event WethChanged(address indexed token);
    event CrudeTokenChanged(address indexed token);
    event FundFactoryChanged(address indexed fund);
    event TriggerFactoryChanged(uint8 indexed flavour, address indexed factory);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error EmptyName();
    error FeeNotCovered(uint256 required, uint256 sent);
    error UnknownPool(address poolAddress);
    error UnknownAsset(address asset);
    error NoBeneficiary();
    error NothingToWithdraw();
    error PrimeBarrelAlreadyOpen();
    error PrimeBarrelMissing();
    error NoFactory();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, uint256 _creationFee, address _aave) {
        owner = _owner;
        creationFee = _creationFee;
        aave = _aave;
    }

    /**
     * Apre il Prime Barrel: il primo barile della compagnia, quello dove gli investitori
     * mettono i soldi e dove arriva l'1% del surplus di tutti gli altri.
     * Si apre una volta sola, e non paga la decima a sé stesso.
     */
    function createPrimeBarrel(
        string calldata poolName,
        address asset,
        address beneficiary
    ) external onlyOwner returns (address) {
        if (primeBarrel != address(0)) revert PrimeBarrelAlreadyOpen();
        if (bytes(poolName).length == 0) revert EmptyName();
        if (beneficiary == address(0)) revert NoBeneficiary();

        address aToken = aTokenOf(asset);
        if (aToken == address(0)) revert UnknownAsset(asset);

        // primeBarrel a zero: il primo barile non paga la decima a sé stesso.
        address poolAddress = _makeFund(poolName, asset, aToken, beneficiary, address(0));

        primeBarrel = poolAddress;
        pools.push(poolAddress);
        isPool[poolAddress] = true;

        emit PoolCreated(poolAddress, msg.sender, poolName, block.number, PoolKind.AaveFund, asset, beneficiary);
        emit PrimeBarrelOpened(poolAddress, asset, beneficiary);

        return poolAddress;
    }

    /// L'aToken con cui Aave risponde per questo token. Zero se Aave non lo tratta.
    function aTokenOf(address asset) public view returns (address) {
        return IAaveReserves(aave).aTokenOf(asset);
    }

    function assetsCount() external view returns (uint256) {
        return IAaveReserves(aave).getReservesList().length;
    }

    /// Le riserve di Aave, col loro simbolo — la lista che il pannello di creazione mostra.
    function getAssets() external view returns (AssetInfo[] memory) {
        address[] memory reserves = IAaveReserves(aave).getReservesList();
        AssetInfo[] memory all = new AssetInfo[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            IERC20Metadata token = IERC20Metadata(reserves[i]);
            all[i] = AssetInfo(reserves[i], aTokenOf(reserves[i]), token.symbol(), token.decimals());
        }
        return all;
    }

    /**
     * Apre un barile nuovo del tipo richiesto. Chi chiama ne diventa il creatore.
     * Per i barili di tipo 1 servono il token su cui lavora e l'indirizzo a cui
     * andrà il surplus. Quanto arriva oltre `creationFee` torna indietro al mittente.
     */
    function createPool(
        string calldata poolName,
        PoolKind kind,
        address asset,
        address beneficiary
    ) external payable returns (address) {
        if (bytes(poolName).length == 0) revert EmptyName();
        if (msg.value < creationFee) revert FeeNotCovered(creationFee, msg.value);

        address poolAddress;
        if (kind == PoolKind.AaveFund) {
            address aToken = aTokenOf(asset);
            if (aToken == address(0)) revert UnknownAsset(asset);
            if (beneficiary == address(0)) revert NoBeneficiary();
            poolAddress = _makeFund(poolName, asset, aToken, beneficiary, primeBarrel);
        } else {
            poolAddress = address(new BasicPool(poolName, msg.sender, address(this)));
        }

        pools.push(poolAddress);
        isPool[poolAddress] = true;

        emit PoolCreated(poolAddress, msg.sender, poolName, block.number, kind, asset, beneficiary);

        uint256 change = msg.value - creationFee;
        if (change > 0) {
            (bool sent, ) = payable(msg.sender).call{ value: change }("");
            if (!sent) revert TransferFailed();
        }

        return poolAddress;
    }

    /**
     * Apre un barile a grilletto: il surplus non se ne va, si accumula finché non basta
     * a pagare la chiamata, e allora chiunque può farlo scattare prendendosi la taglia.
     * Bersaglio, chiamata e taglia si fissano adesso e non si toccano più.
     */
    function createTriggerBarrel(
        string calldata poolName,
        address asset,
        TriggerSpec calldata spec
    ) external payable returns (address) {
        if (bytes(poolName).length == 0) revert EmptyName();
        if (msg.value < creationFee) revert FeeNotCovered(creationFee, msg.value);

        address aToken = aTokenOf(asset);
        if (aToken == address(0)) revert UnknownAsset(asset);

        address factory = triggerFactoryOf[spec.flavour];
        if (factory == address(0)) revert NoFactory();
        address poolAddress = ITriggerBarrelFactory(factory).create(_setup(poolName, asset, aToken, primeBarrel), spec);

        pools.push(poolAddress);
        isPool[poolAddress] = true;

        emit PoolCreated(poolAddress, msg.sender, poolName, block.number, PoolKind.AaveTrigger, asset, spec.target);
        emit TriggerBarrelOpened(poolAddress, spec.target, spec.bounty);

        uint256 change = msg.value - creationFee;
        if (change > 0) {
            (bool sent, ) = payable(msg.sender).call{ value: change }("");
            if (!sent) revert TransferFailed();
        }

        return poolAddress;
    }

    function setFundFactory(address fund) external onlyOwner {
        fundFactory = fund;
        emit FundFactoryChanged(fund);
    }

    function setTriggerFactory(uint8 flavour, address factory) external onlyOwner {
        triggerFactoryOf[flavour] = factory;
        emit TriggerFactoryChanged(flavour, factory);
    }

    function setSwapRouter(address router) external onlyOwner {
        swapRouter = router;
        emit SwapRouterChanged(router);
    }

    /**
     * Attacca al Prime Barrel il titolo della PRIME DAO: uno ogni `every` versati.
     * Il contratto del titolo va messo al mondo dopo il barile, perché deve sapere
     * chi è l'unico che può coniarne.
     */
    function setPrimeShareNft(address nft, uint256 every) external onlyOwner {
        if (primeBarrel == address(0)) revert PrimeBarrelMissing();
        AaveFundPool(primeBarrel).setShareNft(nft, every);
    }

    function setWeth(address token) external onlyOwner {
        weth = token;
        emit WethChanged(token);
    }

    function setCrudeToken(address token) external onlyOwner {
        crudeToken = token;
        emit CrudeTokenChanged(token);
    }

    /**
     * I token estranei fermi nella cassa di un barile, quelli che si possono cambiare.
     * L'elenco lo tiene il barile stesso: gliel'ha detto chi glieli ha mandati.
     */
    function foreignHoldings(
        address poolAddress
    ) external view returns (AssetInfo[] memory found, uint256[] memory amounts) {
        if (!isPool[poolAddress]) revert UnknownPool(poolAddress);

        address[] memory dichiarati = AaveFundPool(poolAddress).foreignTokensList();

        AssetInfo[] memory tutti = new AssetInfo[](dichiarati.length);
        uint256[] memory saldi = new uint256[](dichiarati.length);
        uint256 quanti = 0;

        for (uint256 i = 0; i < dichiarati.length; i++) {
            uint256 saldo = IERC20Metadata(dichiarati[i]).balanceOf(poolAddress);
            if (saldo == 0) continue;

            IERC20Metadata token = IERC20Metadata(dichiarati[i]);
            tutti[quanti] = AssetInfo(dichiarati[i], aTokenOf(dichiarati[i]), token.symbol(), token.decimals());
            saldi[quanti] = saldo;
            quanti++;
        }

        found = new AssetInfo[](quanti);
        amounts = new uint256[](quanti);
        for (uint256 i = 0; i < quanti; i++) {
            found[i] = tutti[i];
            amounts[i] = saldi[i];
        }
    }

    function setCreationFee(uint256 newFee) external onlyOwner {
        uint256 previousFee = creationFee;
        creationFee = newFee;
        emit CreationFeeChanged(previousFee, newFee);
    }

    function withdraw(address payable to) external onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool sent, ) = to.call{ value: amount }("");
        if (!sent) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function _setup(
        string calldata poolName,
        address asset,
        address aToken,
        address prime
    ) internal view returns (BarrelSetup memory) {
        return BarrelSetup(poolName, msg.sender, asset, aave, aToken, prime, address(this));
    }

    function _makeFund(
        string calldata poolName,
        address asset,
        address aToken,
        address beneficiary,
        address prime
    ) internal returns (address) {
        if (fundFactory == address(0)) revert NoFactory();
        return IFundBarrelFactory(fundFactory).create(_setup(poolName, asset, aToken, prime), beneficiary);
    }

    function poolsCount() external view returns (uint256) {
        return pools.length;
    }

    /// I dati di un barile, letti dal barile stesso.
    function getPoolInfo(address poolAddress) public view returns (PoolInfo memory) {
        if (!isPool[poolAddress]) revert UnknownPool(poolAddress);

        PoolBase pool = PoolBase(poolAddress);
        PoolInfo memory info;
        info.poolAddress = poolAddress;
        info.name = pool.name();
        info.creator = pool.creator();
        info.creationBlock = pool.creationBlock();
        info.kind = pool.kind();
        info.isPrime = poolAddress == primeBarrel;

        if (info.kind == PoolKind.AaveFund || info.kind == PoolKind.AaveTrigger) {
            AaveFundPool barrel = AaveFundPool(poolAddress);
            IERC20Metadata token = IERC20Metadata(barrel.asset());
            info.asset = address(token);
            info.assetSymbol = token.symbol();
            info.assetDecimals = token.decimals();
            info.principal = barrel.principal();
            info.totalAssets = barrel.totalAssets();
            info.surplus = barrel.surplus();

            info.shareNft = barrel.shareNft();
            info.shareNftEvery = barrel.shareNftEvery();

            if (info.kind == PoolKind.AaveFund) {
                info.beneficiary = barrel.beneficiary();
            } else {
                AaveTriggerPool trigger = AaveTriggerPool(poolAddress);
                info.target = trigger.target();
                info.bounty = trigger.bounty();
                info.shotCost = trigger.shotCost();
                info.shots = trigger.shots();
                info.subtype = trigger.flavour();
                info.ethValue = trigger.flavour() == 1 ? EthTriggerPool(payable(poolAddress)).ethValue() : 0;
            }
        }

        return info;
    }

    /// Tutti i barili in una sola lettura, così la lista si disegna con una chiamata.
    function getAllPools() external view returns (PoolInfo[] memory) {
        PoolInfo[] memory all = new PoolInfo[](pools.length);
        for (uint256 i = 0; i < pools.length; i++) {
            all[i] = getPoolInfo(pools[i]);
        }
        return all;
    }
}
