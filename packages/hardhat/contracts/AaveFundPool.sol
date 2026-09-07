//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AaveBarrel } from "./AaveBarrel.sol";
import { BarrelSetup, PoolKind } from "./PoolBase.sol";

/**
 * Aave Fund Barrel — il tipo 1.
 *
 * Il surplus non resta: chiunque preme burn e se ne va tutto all'indirizzo scelto
 * quando il barile è nato. Nessuna condizione, nessuna soglia. Il capitale non si muove.
 * @author Oil Company
 */
contract AaveFundPool is AaveBarrel {
    /// Dove va a finire il surplus quando qualcuno preme burn.
    address public immutable beneficiary;

    event SurplusBurned(address indexed to, uint256 amount, address indexed prime, uint256 tithe);

    error NoSurplus();

    constructor(BarrelSetup memory setup, address beneficiaryAddress) AaveBarrel(setup, PoolKind.AaveFund) {
        beneficiary = beneficiaryAddress;
    }

    /**
     * Manda il surplus all'indirizzo scelto quando il barile è nato, tolta la decima
     * dell'1% che va al Prime Barrel. Il capitale resta dov'è: escono solo gli interessi.
     */
    function burnSurplus() external returns (uint256 amount) {
        uint256 daBruciare = surplus();
        if (daBruciare == 0) revert NoSurplus();

        uint256 tithe;
        (amount, tithe) = _takeFromSurplus(daBruciare);
        assetToken.transfer(beneficiary, amount);

        emit SurplusBurned(beneficiary, amount, primeBarrel, tithe);
    }
}
