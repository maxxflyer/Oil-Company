"use client";

import { subtypeOf } from "./poolKind";
import type { PoolInfo } from "./types";
import { Address } from "@scaffold-ui/components";
import { Zap } from "lucide-react";
import { formatEther } from "viem";
import { useTriggerActions } from "~~/hooks/useTriggerActions";
import { formatAmount } from "~~/utils/amount";

/**
 * La pila: quanto è carica, quanto costa uno scatto, e il grilletto.
 */
export const TriggerPanel = ({ pool, onChange }: { pool: PoolInfo; onChange: () => void }) => {
  const { trigger, isBusy } = useTriggerActions(pool.poolAddress);
  const sub = subtypeOf(pool.kind, pool.subtype);

  const carica = pool.surplus;
  const serve = pool.shotCost;
  const pronta = serve > 0n && carica >= serve;
  const percentuale = serve === 0n ? 0 : Math.min(100, Number((carica * 100n) / serve));

  const spara = async () => {
    if (await trigger()) onChange();
  };

  return (
    <div className="neon-panel clip-corner border-warning/40 p-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col">
          <span className="tag-line text-warning">charge</span>
          <span className="text-3xl font-bold text-warning neon-text">
            {formatAmount(carica, pool.assetDecimals)} {pool.assetSymbol}
          </span>
        </div>
        <div className="flex flex-col sm:items-end">
          <span className="tag-line">one shot costs</span>
          <span className="text-2xl font-bold text-primary">
            {formatAmount(serve, pool.assetDecimals)} {pool.assetSymbol}
          </span>
          <span className="text-xs opacity-60">{formatAmount(pool.bounty, pool.assetDecimals)} bounty + 1% tithe</span>
        </div>
      </div>

      <div className="h-2 w-full bg-base-200 border border-warning/30">
        <div
          className="h-full bg-warning transition-[width] duration-500"
          style={{ width: `${percentuale}%` }}
          aria-label={`charge ${percentuale}%`}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3 border-t border-warning/25 pt-6">
        <div className="flex flex-col gap-2 min-w-0">
          <span className="tag-line">it calls</span>
          <div className="min-w-0 overflow-x-auto">
            <Address address={pool.target} format="long" size="sm" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="tag-line">{sub ? sub.label.toLowerCase() : "times fired"}</span>
          <span className="text-sm opacity-70">
            {pool.ethValue > 0n
              ? `attaches ${formatEther(pool.ethValue)} ETH, bought when it fires`
              : "attaches nothing"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="tag-line">times fired</span>
          <span className="text-2xl font-bold text-primary neon-text">{pool.shots.toString()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-warning/25 pt-6">
        <button
          type="button"
          onClick={spara}
          disabled={isBusy || !pronta}
          className="btn btn-warning w-full gap-2 disabled:opacity-40"
        >
          {isBusy ? <span className="loading loading-spinner loading-sm" /> : <Zap className="h-4 w-4" />}
          {pronta ? "Pull the trigger" : "Not charged yet"}
        </button>
        <span className="tag-line text-center">
          whoever pulls it pays the gas and takes the bounty · target and call cannot be changed
        </span>
      </div>
    </div>
  );
};
