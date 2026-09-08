"use client";

import type { PoolInfo } from "./types";
import { Ticket } from "lucide-react";
import { erc721Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { aaveFundPoolAbi } from "~~/contracts/poolAbis";
import { formatAmount } from "~~/utils/amount";

/**
 * Il titolo della PRIME DAO: quanti ne hai e quanto manca al prossimo.
 */
export const PrimeSharePanel = ({ pool }: { pool: PoolInfo }) => {
  const { address } = useAccount();

  const { data: quanti } = useReadContract({
    address: pool.shareNft,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: manca } = useReadContract({
    address: pool.poolAddress,
    abi: aaveFundPoolAbi,
    functionName: "toNextShare",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  return (
    <div className="neon-panel neon-panel-accent clip-corner p-8 flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Ticket className="h-10 w-10 shrink-0 text-secondary" strokeWidth={1.25} />
        <div>
          <span className="tag-line text-secondary">prime dao</span>
          <h2 className="text-2xl font-bold text-secondary neon-text m-0">
            One share every {formatAmount(pool.shareNftEvery, pool.assetDecimals)} {pool.assetSymbol}
          </h2>
        </div>
      </div>

      <p className="m-0 opacity-80 text-sm">
        Put money into the Prime Barrel and you get a share for every{" "}
        {formatAmount(pool.shareNftEvery, pool.assetDecimals)} {pool.assetSymbol} you put in. The share is an NFT, and
        it is your vote in the PRIME DAO — the assembly that runs Oil Company. It can be given away or sold, and the
        vote goes with it.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 border-t border-secondary/25 pt-5">
        <div className="flex flex-col">
          <span className="tag-line">shares you hold</span>
          <span className="text-3xl font-bold text-secondary neon-text">{quanti?.toString() ?? "…"}</span>
        </div>
        <div className="flex flex-col sm:items-end">
          <span className="tag-line">to the next one</span>
          <span className="text-3xl font-bold text-primary neon-text">
            {manca === undefined ? "…" : formatAmount(manca, pool.assetDecimals)} {pool.assetSymbol}
          </span>
        </div>
      </div>

      <span className="tag-line">
        shares are counted on what you have put in, all of it, ever · giving one away does not make another
      </span>
    </div>
  );
};
