"use client";

import { useState } from "react";
import { CreatePoolCard } from "./_components/CreatePoolCard";
import { CreatePoolModal } from "./_components/CreatePoolModal";
import { KindFilter } from "./_components/KindFilter";
import { PoolCard } from "./_components/PoolCard";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const Pools: NextPage = () => {
  const [isDrilling, setIsDrilling] = useState(false);
  const [filtro, setFiltro] = useState<number | null>(null);

  const {
    data: pools,
    isLoading,
    refetch,
  } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "getAllPools",
  });
  const { data: creationFee } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "creationFee",
  });

  const conteggi: Record<number, number> = {};
  for (const pool of pools ?? []) conteggi[pool.kind] = (conteggi[pool.kind] ?? 0) + 1;
  const mostrati = (pools ?? []).filter(pool => filtro === null || pool.kind === filtro);

  return (
    <div className="flex flex-col grow w-full px-6 py-10 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-primary/30 pb-5">
        <div>
          <span className="tag-line">the field</span>
          <h1 className="text-4xl font-bold text-primary neon-text m-0">Pools</h1>
        </div>
        <div className="flex flex-col items-end text-sm">
          <span className="tag-line">barrels open</span>
          <span className="text-2xl font-bold text-secondary neon-text">{pools?.length ?? 0}</span>
        </div>
      </div>

      <p className="tag-line mt-5">
        opening a barrel costs {creationFee === undefined ? "…" : `${formatEther(creationFee)} ETH`}
      </p>

      <div className="mt-2 mb-1">
        <KindFilter value={filtro} onChange={setFiltro} counts={conteggi} />
      </div>

      {isLoading ? (
        <div className="grid gap-5 mt-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="neon-panel clip-corner min-h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 mt-4 sm:grid-cols-2 lg:grid-cols-3">
          {mostrati.map(pool => (
            <PoolCard key={pool.poolAddress} pool={pool} onChange={refetch} />
          ))}
          <CreatePoolCard onClick={() => setIsDrilling(true)} />
        </div>
      )}

      {isDrilling && (
        <CreatePoolModal
          onClose={() => setIsDrilling(false)}
          onCreated={() => {
            setIsDrilling(false);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default Pools;
