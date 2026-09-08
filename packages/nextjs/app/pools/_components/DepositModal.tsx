"use client";

import { useState } from "react";
import type { PoolInfo } from "./types";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { usePoolActions } from "~~/hooks/usePoolActions";
import { formatAmount } from "~~/utils/amount";

/**
 * Il pannello per versare in un barile di tipo 1.
 * Sono due firme: l'autorizzazione e il versamento vero.
 */
export const DepositModal = ({
  pool,
  onClose,
  onDone,
}: {
  pool: PoolInfo;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [amount, setAmount] = useState("");
  const { address } = useAccount();
  const { deposit, grabTokens, isBusy } = usePoolActions(pool.poolAddress, pool.asset);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: pool.asset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const quanti = (testo: string) => {
    try {
      return parseUnits(testo || "0", pool.assetDecimals);
    } catch {
      return 0n;
    }
  };

  const versa = async () => {
    const assets = quanti(amount);
    if (assets <= 0n) return;
    if (await deposit(assets)) {
      onDone();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-200/80">
      <div className="neon-panel clip-corner w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <span className="tag-line">deposit into</span>
            <h3 className="text-2xl font-bold text-primary neon-text m-0 break-words">{pool.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-2" aria-label="close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="tag-line">how much {pool.assetSymbol}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value.replace(",", "."))}
            onKeyDown={event => {
              if (event.key === "Enter") versa();
            }}
            placeholder="100"
            className="input input-bordered w-full bg-base-200 border-primary/50 focus:border-primary focus:outline-none"
          />
        </label>

        <div className="flex items-center justify-between text-sm border-t border-primary/25 pt-4">
          <span className="tag-line">in your wallet</span>
          <div className="flex items-center gap-3">
            <span className="text-primary neon-text font-bold">
              {formatAmount(balance, pool.assetDecimals)} {pool.assetSymbol}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              disabled={isBusy}
              onClick={async () => {
                if (await grabTokens(parseUnits("1000", pool.assetDecimals))) refetchBalance();
              }}
            >
              grab 1000
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={versa}
          disabled={isBusy || quanti(amount) <= 0n}
          className="btn btn-primary w-full"
        >
          {isBusy ? <span className="loading loading-spinner loading-sm" /> : "Deposit"}
        </button>
        {pool.shareNft !== "0x0000000000000000000000000000000000000000" && pool.shareNftEvery > 0n ? (
          <p className="tag-line m-0 text-center text-secondary">
            every {formatAmount(pool.shareNftEvery, pool.assetDecimals)} {pool.assetSymbol} you put in earns one PRIME
            DAO share
          </p>
        ) : null}
        <p className="tag-line m-0 text-center">two signatures: the approval first, then the deposit</p>
        <p className="tag-line m-0 text-center">deposits are locked: no way back out, for now</p>
      </div>
    </div>
  );
};
