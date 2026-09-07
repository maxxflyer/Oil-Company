//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * Il titolo della PRIME DAO.
 *
 * Chi mette denaro nel Prime Barrel ne riceve uno ogni cento unità versate: è la voce
 * che avrà in assemblea. Il Prime Barrel è l'unico che può coniarne, e li conia solo
 * contro denaro davvero entrato.
 *
 * È un NFT come gli altri: si regala, si vende, e il voto va con lui.
 * @author Oil Company
 */
contract PrimeShareNFT is ERC721 {
    /// L'unico che può coniare: il barile a cui questo titolo appartiene.
    address public immutable barrel;
    uint256 public totalMinted;

    error OnlyBarrel();

    constructor(address barrelAddress) ERC721("Oil Company Prime Share", "PRIME") {
        barrel = barrelAddress;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != barrel) revert OnlyBarrel();

        totalMinted += 1;
        tokenId = totalMinted;
        _safeMint(to, tokenId);
    }

    /// Quanti ne esistono in tutto.
    function totalSupply() external view returns (uint256) {
        return totalMinted;
    }
}
