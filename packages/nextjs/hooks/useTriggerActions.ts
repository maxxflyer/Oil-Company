"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useWriteContract } from "wagmi";
import { aaveTriggerPoolAbi } from "~~/contracts/poolAbis";
import { useTransactor } from "~~/hooks/scaffold-eth";

/// Premere il grilletto di una pila.
export const useTriggerActions = (pool: Address) => {
  const [isBusy, setIsBusy] = useState(false);
  const writeTx = useTransactor();
  const { writeContractAsync } = useWriteContract();

  const trigger = async () => {
    setIsBusy(true);
    try {
      await writeTx(() =>
        writeContractAsync({ address: pool, abi: aaveTriggerPoolAbi, functionName: "trigger", args: [] }),
      );
      return true;
    } finally {
      setIsBusy(false);
    }
  };

  return { trigger, isBusy };
};
