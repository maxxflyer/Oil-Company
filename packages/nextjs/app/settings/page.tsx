"use client";

import { useState } from "react";
import { Address, Balance, EtherInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { OwnerOnly } from "~~/components/OwnerOnly";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

/**
 * Sala controllo: da qui chi possiede il registro decide quanto costa aprire un barrel.
 */
const Settings: NextPage = () => {
  const [newFee, setNewFee] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const { data: registry } = useDeployedContractInfo({ contractName: "PoolRegistry" });

  const { data: creationFee, refetch } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "creationFee",
  });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "PoolRegistry" });

  const applyFee = async () => {
    if (!newFee) return;
    await writeContractAsync(
      { functionName: "setCreationFee", args: [parseEther(newFee)] },
      {
        onBlockConfirmation: () => {
          setNewFee("");
          setInputKey(key => key + 1);
          refetch();
        },
      },
    );
  };

  return (
    <OwnerOnly>
      <div className="flex flex-col grow w-full px-6 py-10 max-w-2xl mx-auto">
        <div className="border-b border-primary/30 pb-5">
          <span className="tag-line">control room</span>
          <h1 className="text-4xl font-bold text-primary neon-text m-0">Settings</h1>
        </div>

        <div className="neon-panel clip-corner p-7 mt-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <span className="tag-line">current cost of a barrel</span>
            <span className="text-2xl font-bold text-secondary neon-text">
              {creationFee === undefined ? "…" : `${formatEther(creationFee)} ETH`}
            </span>
          </div>

          <label className="flex flex-col gap-2 border-t border-primary/25 pt-6">
            <span className="tag-line">new cost</span>
            <div className="w-full [&>div]:w-full">
              <EtherInput
                key={inputKey}
                defaultValue={newFee}
                onValueChange={({ valueInEth }) => setNewFee(valueInEth)}
                placeholder="0.001"
              />
            </div>
          </label>

          <button type="button" onClick={applyFee} disabled={!newFee || isMining} className="btn btn-primary w-full">
            {isMining ? <span className="loading loading-spinner loading-sm" /> : "Apply"}
          </button>
        </div>

        <div className="neon-panel clip-corner p-7 mt-5 flex flex-col gap-4">
          <span className="tag-line">registry treasury</span>
          {registry?.address ? (
            <>
              <Address address={registry.address} format="long" size="sm" />
              <Balance address={registry.address} />
            </>
          ) : null}
        </div>
      </div>
    </OwnerOnly>
  );
};

export default Settings;
