"use client";

import { useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { aaveFundPoolAbi } from "~~/contracts/poolAbis";
import { useTransactor } from "~~/hooks/scaffold-eth";

const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * I gesti su un barile di tipo 1: versare, riprendere, bruciare il surplus.
 *
 * Versare sono due firme: prima si autorizza il barile a prendere il token,
 * poi il barile lo prende e lo porta in Aave.
 */
export const usePoolActions = (pool: Address, asset?: Address) => {
  const [isBusy, setIsBusy] = useState(false);
  const { address } = useAccount();
  const writeTx = useTransactor();
  const { writeContractAsync } = useWriteContract();

  const deposit = async (assets: bigint) => {
    if (!asset || assets <= 0n) return false;
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({ address: asset, abi: erc20Abi, functionName: "approve", args: [pool, assets] }),
      );
      await writeTx(() =>
        writeContractAsync({ address: pool, abi: aaveFundPoolAbi, functionName: "deposit", args: [assets] }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  /// Manda il surplus all'indirizzo scelto quando il barile è nato.
  const burnSurplus = async () => {
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({ address: pool, abi: aaveFundPoolAbi, functionName: "burnSurplus", args: [] }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  /// Passa da Uniswap i token estranei fermi in cassa e ne fa il token del barile.
  const convertForeign = async (tokens: Address[]) => {
    if (!tokens.length) return false;
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({
          address: pool,
          abi: aaveFundPoolAbi,
          functionName: "convertForeign",
          args: [tokens, tokens.map(() => 0n)],
        }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  /// Dice al barile che un token gli è arrivato senza che nessuno si annunciasse.
  const noteForeign = async (token: Address) => {
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({ address: pool, abi: aaveFundPoolAbi, functionName: "noteForeign", args: [token] }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  /// Rubinetto: i token di questa catena sono finti e chiunque può coniarseli.
  const grabTokens = async (amount: bigint) => {
    if (!asset || !address) return false;
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({ address: asset, abi: mintAbi, functionName: "mint", args: [address, amount] }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  return { deposit, burnSurplus, convertForeign, noteForeign, grabTokens, isBusy };
};
