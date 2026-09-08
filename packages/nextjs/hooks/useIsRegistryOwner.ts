"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * Dice se chi è collegato è il proprietario del registro — cioè chi ha messo su la dapp.
 * Solo lui vede Settings e può cambiare il prezzo di un barile.
 */
export const useIsRegistryOwner = () => {
  const { address } = useAccount();
  const { data: owner, isLoading } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "owner",
  });

  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());

  return { owner, isOwner, isLoading };
};
