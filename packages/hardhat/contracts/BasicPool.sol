//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PoolBase, PoolKind } from "./PoolBase.sol";

/**
 * Il barile più semplice: un nome, un creatore, un blocco. Niente altro dentro.
 * @author Oil Company
 */
contract BasicPool is PoolBase {
    string private _name;

    constructor(
        string memory poolName,
        address poolCreator,
        address registryAddress
    ) PoolBase(poolCreator, PoolKind.Basic, registryAddress) {
        _name = poolName;
    }

    function name() public view override returns (string memory) {
        return _name;
    }
}
