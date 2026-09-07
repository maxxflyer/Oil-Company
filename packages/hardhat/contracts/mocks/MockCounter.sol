//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * Un bersaglio per provare i barili a grilletto: conta le volte che è stato chiamato
 * e si ricorda chi l'ha chiamato per ultimo. `poke()` non chiede niente in cambio,
 * quindi il costo dello scatto è tutto nel gas.
 * @author Oil Company
 */
contract MockCounter {
    uint256 public count;
    address public lastCaller;
    uint256 public collected;
    bool public jammed;

    event Poked(address indexed caller, uint256 count);

    error Jammed();

    function poke() external {
        if (jammed) revert Jammed();
        count += 1;
        lastCaller = msg.sender;
        emit Poked(msg.sender, count);
    }

    /// Come poke(), ma vuole dei soldi: serve a provare i barili che allegano ETH.
    function pay() external payable {
        if (jammed) revert Jammed();
        count += 1;
        lastCaller = msg.sender;
        collected += msg.value;
        emit Poked(msg.sender, count);
    }

    /// Per provare cosa succede quando il bersaglio rifiuta.
    function setJammed(bool value) external {
        jammed = value;
    }
}
