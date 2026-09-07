//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AaveTriggerPool } from "./AaveTriggerPool.sol";
import { BarrelSetup } from "./PoolBase.sol";

/**
 * Trigger Barrel, sottotipo «chiamata secca».
 *
 * Chiama e basta: non allega niente, quindi uno scatto costa solo la taglia più la
 * decima. È il caso di `harvest()`, di una proposta già votata da eseguire, di un
 * riscatto fatto per conto d'altri.
 * @author Oil Company
 */
contract PlainTriggerPool is AaveTriggerPool {
    constructor(
        BarrelSetup memory setup,
        address targetAddress,
        bytes memory targetCall,
        uint256 bountyAmount
    ) AaveTriggerPool(setup, targetAddress, targetCall, bountyAmount) {}

    function flavour() public pure override returns (uint8) {
        return 0;
    }

    function _fire() internal override {
        _call(0);
    }
}
