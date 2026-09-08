//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AaveFundPool } from "./AaveFundPool.sol";
import { EthTriggerPool } from "./EthTriggerPool.sol";
import { PlainTriggerPool } from "./PlainTriggerPool.sol";
import { BarrelSetup, TriggerSpec } from "./PoolBase.sol";

/**
 * Le fabbriche dei barili — una per sottotipo.
 *
 * Un contratto che ne costruisce un altro si porta dentro tutto il codice di quello,
 * e su Ethereum non se ne possono distribuire più di ventiquattromila byte. Il registro
 * che sapeva costruire ogni tipo ne pesava trentatré; una sola fabbrica per tutti i
 * grilletti ne pesava ventisei. Una per sottotipo tiene tutti sotto il limite, e il
 * sottotipo che verrà non farà ingrassare nessuno.
 * @author Oil Company
 */
interface IFundBarrelFactory {
    function create(BarrelSetup calldata setup, address beneficiary) external returns (address);
}

interface ITriggerBarrelFactory {
    function create(BarrelSetup calldata setup, TriggerSpec calldata spec) external returns (address);
}

contract FundBarrelFactory is IFundBarrelFactory {
    function create(BarrelSetup calldata setup, address beneficiary) external returns (address) {
        return address(new AaveFundPool(setup, beneficiary));
    }
}

/// Sottotipo 0: chiama e basta.
contract PlainTriggerFactory is ITriggerBarrelFactory {
    function create(BarrelSetup calldata setup, TriggerSpec calldata spec) external returns (address) {
        return address(new PlainTriggerPool(setup, spec.target, spec.callData, spec.bounty));
    }
}

/// Sottotipo 1: chiama allegando ETH, comprato al momento.
contract EthTriggerFactory is ITriggerBarrelFactory {
    function create(BarrelSetup calldata setup, TriggerSpec calldata spec) external returns (address) {
        return address(new EthTriggerPool(setup, spec.target, spec.callData, spec.bounty, spec.ethValue));
    }
}
