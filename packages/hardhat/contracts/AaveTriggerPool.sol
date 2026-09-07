//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AaveBarrel } from "./AaveBarrel.sol";
import { BarrelSetup, PoolKind } from "./PoolBase.sol";

/**
 * Aave Trigger Barrel — il tipo 2, il motore comune a tutti i suoi sottotipi.
 *
 * È una pila. Il denaro versato frutta in Aave come in un fund barrel, ma il surplus
 * non se ne va: si accumula. Quando basta, chiunque passa può premere il grilletto, e
 * il barile chiama una funzione su un contratto deciso quando è nato.
 *
 * Il gas di quella transazione lo paga chi preme — un contratto non può pagare il
 * proprio gas — quindi il barile gli riconosce una **taglia**, fissata alla nascita e
 * pagata nel token del barile. Chi passa guarda se gli conviene: se il gas costa meno
 * della taglia preme e ci guadagna, se costa di più aspetta.
 *
 * Bersaglio e chiamata sono immutabili: chi versa sa cosa sta finanziando, e nessuno
 * può puntare i soldi altrove — nemmeno chi l'ha creato.
 *
 * Cosa costa uno scatto oltre la taglia, e cosa fare al momento di sparare, lo decide
 * il sottotipo: qui ci sono i due buchi da riempire, `_extraCost` e `_fire`.
 * @author Oil Company
 */
abstract contract AaveTriggerPool is AaveBarrel, ReentrancyGuard {
    /// Il contratto che il barile chiama.
    address public immutable target;
    /// Cosa gli dice: selettore e argomenti, decisi alla nascita.
    bytes public callData;
    /// Quanto prende chi preme il grilletto, nel token del barile.
    uint256 public immutable bounty;
    /// Quante volte è scattato.
    uint256 public shots;

    event Triggered(address indexed puller, uint256 bounty, uint256 tithe, uint256 shot);

    error NoTarget();
    error EmptyCall();
    error NotCharged(uint256 charge, uint256 needed);
    error ShotFailed(bytes reason);

    constructor(
        BarrelSetup memory setup,
        address targetAddress,
        bytes memory targetCall,
        uint256 bountyAmount
    ) AaveBarrel(setup, PoolKind.AaveTrigger) {
        if (targetAddress == address(0)) revert NoTarget();
        if (targetCall.length == 0) revert EmptyCall();

        target = targetAddress;
        callData = targetCall;
        bounty = bountyAmount;
    }

    /// Che sottotipo è: 0 chiamata secca, 1 chiamata con ETH allegato.
    function flavour() public pure virtual returns (uint8);

    /// Quanto costa lo scatto oltre la taglia. Zero se la chiamata non allega niente.
    function extraCost() public view virtual returns (uint256) {
        return 0;
    }

    /// Quanto esce a ogni scatto: la taglia, la decima, e quel che serve alla chiamata.
    function shotCost() public view returns (uint256) {
        return bounty + extraCost() + _titheOn(bounty);
    }

    /// Quanto ha in pancia adesso: il surplus è la carica della pila.
    function charge() public view returns (uint256) {
        return surplus();
    }

    /// Se è abbastanza carica da scattare.
    function ready() public view returns (bool) {
        return charge() >= shotCost();
    }

    /**
     * Scatta. Paga la taglia a chi ha premuto, la decima al Prime Barrel, e chiama il
     * bersaglio. Se la chiamata fallisce salta tutto, taglia compresa: nessuno si fa
     * pagare per uno scatto a vuoto.
     */
    function trigger() external nonReentrant returns (uint256 shot) {
        uint256 needed = shotCost();
        uint256 carica = charge();
        if (carica < needed) revert NotCharged(carica, needed);

        uint256 tithe = _titheOn(bounty);
        _fromAave(needed);
        _payTithe(tithe);
        if (bounty > 0) assetToken.transfer(msg.sender, bounty);

        shots += 1;
        shot = shots;

        _fire();

        emit Triggered(msg.sender, bounty, tithe, shot);
    }

    /// Come si spara: il sottotipo ci mette la chiamata, con quel che le allega.
    function _fire() internal virtual;

    /// La chiamata al bersaglio, con o senza ETH attaccato.
    function _call(uint256 value) internal {
        (bool ok, bytes memory reason) = target.call{ value: value }(callData);
        if (!ok) revert ShotFailed(reason);
    }
}
