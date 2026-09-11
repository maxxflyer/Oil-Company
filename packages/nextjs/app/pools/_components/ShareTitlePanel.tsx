"use client";

import type { PoolInfo } from "./types";
import { Ticket } from "lucide-react";
import { erc721Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { aaveFundPoolAbi } from "~~/contracts/poolAbis";
import { formatAmount } from "~~/utils/amount";

/**
 * Il titolo che un barile consegna a chi versa: quanti ne hai e quanto manca al
 * prossimo. Il Prime Barrel dà quello della PRIME DAO; ogni progetto lanciato con
 * un barile suo dà il proprio.
 */
export const ShareTitlePanel = ({ pool }: { pool: PoolInfo }) => {
  const { address } = useAccount();

  const { data: simbolo } = useReadContract({
    address: pool.shareNft,
    abi: erc721Abi,
    functionName: "symbol",
  });
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

  const ogni = `${formatAmount(pool.shareNftEvery, pool.assetDecimals)} ${pool.assetSymbol}`;
  const barile = pool.isPrime ? "the Prime Barrel" : "this barrel";
  const assemblea = pool.isPrime ? "the PRIME DAO — the assembly that runs Oil Company" : `the ${pool.name} assembly`;

  return (
    <div className="neon-panel neon-panel-accent clip-corner p-8 flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Ticket className="h-10 w-10 shrink-0 text-secondary" strokeWidth={1.25} />
        <div>
          <span className="tag-line text-secondary">{pool.isPrime ? "prime dao" : "shares"}</span>
          <h2 className="text-2xl font-bold text-secondary neon-text m-0">
            One {simbolo ?? "share"} every {ogni}
          </h2>
        </div>
      </div>

      <p className="m-0 opacity-80 text-sm">
        Put money into {barile} and you get a share for every {ogni} you put in. The share is an NFT, and it is your
        vote in {assemblea}. It can be given away or sold, and the vote goes with it.
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
