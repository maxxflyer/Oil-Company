"use client";

import { useState } from "react";
import Link from "next/link";
import { DepositModal } from "./DepositModal";
import { TokenIcon } from "./TokenIcon";
import { kindOf, subtypeOf } from "./poolKind";
import type { PoolInfo } from "./types";
import { Address } from "@scaffold-ui/components";
import { Zap } from "lucide-react";
import { FireIcon, PlusIcon } from "@heroicons/react/24/outline";
import { usePoolActions } from "~~/hooks/usePoolActions";
import { useTriggerActions } from "~~/hooks/useTriggerActions";
import { formatAmount } from "~~/utils/amount";

/**
 * Un barile nell'elenco: nome, blocco in cui è stato aperto, chi l'ha aperto.
 * Quelli di tipo 1 dicono anche su che token lavorano, quanto capitale hanno dentro
 * e quanto surplus hanno maturato — e da qui si versa o si brucia.
 */
export const PoolCard = ({ pool, onChange }: { pool: PoolInfo; onChange: () => void }) => {
  const [isDepositing, setIsDepositing] = useState(false);
  const kind = kindOf(pool.kind);
  const sub = subtypeOf(pool.kind, pool.subtype);
  // L'icona grande è quella del tipo — il barile si riconosce da quella.
  // Il sottotipo si aggiunge di fianco, in piccolo.
  const Icona = kind.icon;
  const SubIcona = sub?.icon;
  const isFund = pool.kind === 1;
  const isTrigger = pool.kind === 2;
  const suAave = isFund || isTrigger;
  const { burnSurplus, isBusy } = usePoolActions(pool.poolAddress, pool.asset);
  const { trigger, isBusy: isFiring } = useTriggerActions(pool.poolAddress);
  const pronta = isTrigger && pool.shotCost > 0n && pool.surplus >= pool.shotCost;

  const brucia = async () => {
    if (await burnSurplus()) onChange();
  };

  return (
    <>
      <div
        className={`neon-panel clip-corner p-5 flex flex-col gap-4 min-h-60 relative hover:-translate-y-0.5 ${kind.look.soft}`}
      >
        <Link href={`/pools/${pool.poolAddress}`} className="absolute inset-0" aria-label={`open ${pool.name}`} />

        <div className="flex items-start justify-between gap-3 relative pointer-events-none">
          <span className={`tag-line flex items-center gap-2 ${kind.look.text}`}>
            {pool.isPrime ? "prime barrel" : kind.tag}
            {SubIcona ? <SubIcona className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} /> : null}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-primary/70">#{pool.creationBlock.toString()}</span>
            {suAave ? <TokenIcon symbol={pool.assetSymbol} className="h-5 w-5" /> : null}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 relative pointer-events-none">
          {/* Il barile principale è la compagnia: porta la goccia, non l'icona del
              suo tipo. Gli altri si riconoscono dal tipo. */}
          {pool.isPrime ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icon.svg" alt="" className="h-[5.6rem] w-[5.6rem]" />
          ) : (
            <Icona className={`h-[5.6rem] w-[5.6rem] ${kind.look.text}`} strokeWidth={1} />
          )}
          <h3 className="text-xl font-bold text-primary neon-text break-words m-0 text-center">
            {pool.name}
            {pool.isPrime ? <span className="ml-2 text-xs align-middle text-secondary">★</span> : null}
          </h3>
        </div>

        {suAave && (
          <div className="flex flex-col gap-2 relative pointer-events-none">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="tag-line">principal</span>
                <span className="text-xl font-bold text-primary flex items-center gap-1.5">
                  {formatAmount(pool.principal, pool.assetDecimals)}
                  <TokenIcon symbol={pool.assetSymbol} className="h-4 w-4" />
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="tag-line">{isTrigger ? "charge" : "surplus"}</span>
                <span className={`text-xl font-bold neon-text ${isTrigger ? "text-warning" : "text-secondary"}`}>
                  {formatAmount(pool.surplus, pool.assetDecimals)}
                </span>
              </div>
            </div>

            {isTrigger && (
              <div className="h-1.5 w-full bg-base-200 border border-warning/30">
                <div
                  className="h-full bg-warning transition-[width] duration-500"
                  style={{
                    width: `${pool.shotCost === 0n ? 0 : Math.min(100, Number((pool.surplus * 100n) / pool.shotCost))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1 relative pointer-events-none">
          <span className="tag-line">opened by</span>
          <div className="pointer-events-auto self-start">
            <Address address={pool.creator} size="xs" disableAddressLink />
          </div>
        </div>

        {suAave && (
          <div className="grid grid-cols-2 gap-2 relative">
            <button
              type="button"
              onClick={() => setIsDepositing(true)}
              className="btn btn-secondary btn-sm gap-1 w-full"
            >
              <PlusIcon className="h-4 w-4" /> Add
            </button>

            {isTrigger ? (
              <button
                type="button"
                onClick={async () => {
                  if (await trigger()) onChange();
                }}
                disabled={isFiring || !pronta}
                className="btn btn-warning btn-sm gap-1 w-full disabled:opacity-40"
                title={`call ${pool.target}`}
              >
                <Zap className="h-4 w-4" /> Trigger
              </button>
            ) : (
              <button
                type="button"
                onClick={brucia}
                disabled={isBusy || pool.surplus === 0n}
                className="btn btn-outline btn-sm gap-1 w-full"
                title={`send the surplus to ${pool.beneficiary}`}
              >
                <FireIcon className="h-4 w-4" /> Burn
              </button>
            )}
          </div>
        )}
      </div>

      {isDepositing && <DepositModal pool={pool} onClose={() => setIsDepositing(false)} onDone={onChange} />}
    </>
  );
};
