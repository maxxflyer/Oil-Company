"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { BugAntIcon, FireIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useIsRegistryOwner } from "~~/hooks/useIsRegistryOwner";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const { data: pools } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "poolsCount" });
  const { data: creationFee } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "creationFee" });
  const { isOwner } = useIsRegistryOwner();

  return (
    <div className="flex items-center flex-col grow pt-14">
      <div className="px-5 flex flex-col items-center">
        <span className="tag-line">crude · onchain · since block zero</span>
        <h1 className="text-center mt-3">
          <span className="block text-5xl sm:text-6xl font-bold text-primary neon-text">Oil Company</span>
        </h1>
        <p className="text-center max-w-xl opacity-70">
          Every barrel is a contract of its own: it carries its name, whoever opened it, and the block it was born in.
        </p>

        <div className="flex items-center gap-3 mt-2">
          <span className="tag-line">connected as</span>
          <Address address={connectedAddress} chain={targetNetwork} />
        </div>

        <Link href="/pools" className="btn btn-primary mt-8 px-10">
          Enter the field
        </Link>

        <div className="flex gap-10 mt-10">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-secondary neon-text">{pools?.toString() ?? "…"}</span>
            <span className="tag-line">barrels open</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-secondary neon-text">
              {creationFee === undefined ? "…" : formatEther(creationFee)}
            </span>
            <span className="tag-line">ETH per barrel</span>
          </div>
        </div>
      </div>

      <div className="grow w-full mt-16 px-8 py-12 border-t border-primary/25 bg-base-100/40">
        <div className="flex justify-center items-stretch gap-8 flex-col md:flex-row max-w-4xl mx-auto">
          <Link href="/pools" className="neon-panel clip-corner px-8 py-9 text-center items-center flex flex-col grow">
            <FireIcon className="h-8 w-8 text-primary" />
            <p className="m-0 mt-3">
              Open a new barrel, or look at the ones already pumping, from the{" "}
              <span className="text-primary">Pools</span> tab.
            </p>
          </Link>
          {isOwner && (
            <Link
              href="/debug"
              className="neon-panel clip-corner px-8 py-9 text-center items-center flex flex-col grow"
            >
              <BugAntIcon className="h-8 w-8 text-primary" />
              <p className="m-0 mt-3">
                Talk to the contracts directly from the <span className="text-primary">Debug Contracts</span> tab.
              </p>
            </Link>
          )}
          <Link
            href="/blockexplorer"
            className="neon-panel clip-corner px-8 py-9 text-center items-center flex flex-col grow"
          >
            <MagnifyingGlassIcon className="h-8 w-8 text-primary" />
            <p className="m-0 mt-3">
              Follow local transactions in the <span className="text-primary">Block Explorer</span>.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
