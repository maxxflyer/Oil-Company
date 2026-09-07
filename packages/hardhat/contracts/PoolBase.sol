//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// I tipi di barile che il registro sa aprire.
enum PoolKind {
    /// Un barile nudo: porta solo il proprio nome e la propria data di nascita.
    Basic,
    /// Tipo 1 — Aave Fund Barrel: il denaro che entra frutta in Aave, e il surplus si brucia
    /// verso un indirizzo, senza condizioni.
    AaveFund,
    /// Tipo 2 — Aave Trigger Barrel: il surplus non se ne va, si accumula finché non
    /// basta a pagare una chiamata a un contratto scelto alla nascita.
    AaveTrigger
}

/**
 * Quello che serve a mettere al mondo un barile su Aave. Viaggia in blocco perché
 * passati uno per uno i parametri erano troppi e il compilatore non ci arrivava.
 */
struct BarrelSetup {
    string name;
    address creator;
    address asset;
    address aave;
    address aToken;
    address primeBarrel;
    address registry;
}

/**
 * Come si comporta un barile a grilletto: che sottotipo è, cosa chiama, quanto paga
 * a chi preme e quanto ETH allega. In blocco, per la stessa ragione di BarrelSetup.
 */
struct TriggerSpec {
    /// 0 chiamata secca, 1 chiamata con ETH allegato.
    uint8 flavour;
    address target;
    bytes callData;
    uint256 bounty;
    uint256 ethValue;
}

/**
 * Quello che ogni barile ha, di qualunque tipo sia: un nome, chi l'ha aperto,
 * il blocco in cui è nato. Il registro legge da qui.
 * @author Oil Company
 */
abstract contract PoolBase {
    address public immutable creator;
    uint256 public immutable creationBlock;
    PoolKind public immutable kind;
    address public immutable registry;

    constructor(address _creator, PoolKind _kind, address _registry) {
        creator = _creator;
        creationBlock = block.number;
        kind = _kind;
        registry = _registry;
    }

    function name() public view virtual returns (string memory);
}
