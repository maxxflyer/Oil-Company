"use client";

import { useState } from "react";
import { DepositModal } from "./DepositModal";
import type { PoolInfo } from "./types";
import { Address } from "@scaffold-ui/components";
import { isAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { FireIcon } from "@heroicons/react/24/outline";
import { aaveFundPoolAbi } from "~~/contracts/poolAbis";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { usePoolActions } from "~~/hooks/usePoolActions";
import { formatAmount } from "~~/utils/amount";

/**
 * La pancia di un barile di tipo 1: capitale, surplus, quanto ne è tuo,
 * e i tre gesti — versare, riprendere, bruciare.
 */
export const PoolAavePanel = ({ pool, onChange }: { pool: PoolInfo; onChange: () => void }) => {
  // In una pila il surplus non si brucia: si spende premendo il grilletto.
  const isTrigger = pool.kind === 2;
  const [isDepositing, setIsDepositing] = useState(false);
  const [stray, setStray] = useState("");
  const { address } = useAccount();
  const { burnSurplus, convertForeign, noteForeign, isBusy } = usePoolActions(pool.poolAddress, pool.asset);

  const mio = { address: pool.poolAddress, abi: aaveFundPoolAbi, query: { enabled: Boolean(address) } } as const;

  const { data: shares, refetch: refetchShares } = useReadContract({
    ...mio,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });
  const { data: myAssets, refetch: refetchAssets } = useReadContract({
    ...mio,
    functionName: "assetsOf",
    args: address ? [address] : undefined,
  });
  const { data: totalShares, refetch: refetchSupply } = useReadContract({
    address: pool.poolAddress,
    abi: aaveFundPoolAbi,
    functionName: "totalSupply",
  });
  const { data: waiting, refetch: refetchPending } = useReadContract({
    address: pool.poolAddress,
    abi: aaveFundPoolAbi,
    functionName: "pending",
  });

  const { data: foreign, refetch: refetchForeign } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "foreignHoldings",
    args: [pool.poolAddress],
  });
  const estranei = foreign?.[0] ?? [];
  const quantita = foreign?.[1] ?? [];

  const aggiorna = () => {
    refetchShares();
    refetchAssets();
    refetchSupply();
    refetchPending();
    refetchForeign();
    onChange();
  };

  const brucia = async () => {
    if (await burnSurplus()) aggiorna();
  };

  return (
    <>
      <div className="neon-panel clip-corner p-8 flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col">
            <span className="tag-line">principal deposited</span>
            <span className="text-2xl font-bold text-primary neon-text">
              {formatAmount(pool.principal, pool.assetDecimals)}
            </span>
            <span className="text-xs opacity-60">{pool.assetSymbol}</span>
          </div>
          <div className="flex flex-col">
            <span className="tag-line">surplus earned</span>
            <span className="text-2xl font-bold text-secondary neon-text">
              {formatAmount(pool.surplus, pool.assetDecimals)}
            </span>
            <span className="text-xs opacity-60">{isTrigger ? "charges the battery" : "goes to the burn address"}</span>
          </div>
          <div className="flex flex-col">
            <span className="tag-line">your principal</span>
            <span className="text-2xl font-bold text-primary neon-text">
              {formatAmount(myAssets, pool.assetDecimals)}
            </span>
            <span className="text-xs opacity-60">
              {formatAmount(shares, pool.assetDecimals)} shares of {formatAmount(totalShares, pool.assetDecimals)}
            </span>
          </div>
        </div>

        <div className={`flex-col gap-2 border-t border-primary/25 pt-6 ${isTrigger ? "hidden" : "flex"}`}>
          <span className="tag-line">surplus goes to</span>
          <Address address={pool.beneficiary} format="long" size="sm" />
          <span className="tag-line mt-1">
            {pool.isPrime
              ? "this is the Prime Barrel: it keeps 1% of every other barrel's surplus, and sends its own to the mechanism above"
              : "on burn, 99% goes there and 1% to the Prime Barrel"}
          </span>
          {waiting !== undefined && waiting > 0n ? (
            <span className="tag-line text-secondary">
              {formatAmount(waiting, pool.assetDecimals)} {pool.assetSymbol} waiting: tithes land as principal as soon
              as a share exists
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-secondary/40 pt-6">
          <span className="tag-line text-secondary">foreign tokens in the vault</span>
          {estranei.length > 0 ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {estranei.map((token, i) => (
                <span key={token.token} className="text-sm">
                  <span className="font-bold text-secondary">{formatAmount(quantita[i], token.decimals)}</span>{" "}
                  {token.symbol}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm opacity-60">
              Nothing to swap. Tithes paid in another token land here and wait.
            </span>
          )}
          <button
            type="button"
            onClick={async () => {
              if (await convertForeign(estranei.map(token => token.token))) aggiorna();
            }}
            disabled={isBusy || estranei.length === 0}
            className="btn btn-outline btn-sm self-start"
          >
            {isBusy ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              `Swap to ${pool.assetSymbol} on Uniswap`
            )}
          </button>
          <span className="tag-line">
            what comes back becomes principal · no price floor is set, fine on a local chain
          </span>

          <div className="flex flex-col gap-2 pt-2">
            <span className="tag-line">
              a barrel cannot see what it holds: whoever pays a tithe announces it. Something that arrived unannounced
              can be pointed out here.
            </span>
            <div className="flex gap-2">
              <input
                value={stray}
                onChange={event => setStray(event.target.value.trim())}
                placeholder="0x… token address"
                className="input input-bordered input-sm grow bg-base-200 border-primary/40 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!isAddress(stray)) return;
                  if (await noteForeign(stray)) {
                    setStray("");
                    aggiorna();
                  }
                }}
                disabled={isBusy || !isAddress(stray)}
                className="btn btn-ghost btn-sm"
              >
                Point it out
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-primary/25 pt-6">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setIsDepositing(true)} className="btn btn-secondary grow">
              Deposit {pool.assetSymbol}
            </button>
            <span className="tag-line">deposits are locked: there is no way to take them back out, for now</span>
            {isTrigger ? null : (
              <button
                type="button"
                onClick={brucia}
                disabled={isBusy || pool.surplus === 0n}
                className="btn btn-outline gap-2"
              >
                <FireIcon className="h-4 w-4" /> Burn surplus
              </button>
            )}
          </div>
        </div>
      </div>

      {isDepositing && <DepositModal pool={pool} onClose={() => setIsDepositing(false)} onDone={aggiorna} />}
    </>
  );
};
