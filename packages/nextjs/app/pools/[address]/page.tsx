"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PoolAavePanel } from "../_components/PoolAavePanel";
import { ShareTitlePanel } from "../_components/ShareTitlePanel";
import { TriggerPanel } from "../_components/TriggerPanel";
import { kindOf } from "../_components/poolKind";
import { Address, Balance } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { isAddress } from "viem";
import type { Address as AddressType } from "viem";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PoolPage: NextPage = () => {
  const params = useParams<{ address: string }>();
  const poolAddress = params?.address as AddressType | undefined;
  const isValid = Boolean(poolAddress && isAddress(poolAddress));

  const {
    data: pool,
    isLoading,
    error,
    refetch,
  } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "getPoolInfo",
    args: [isValid ? poolAddress : undefined],
    query: { enabled: isValid },
  });

  return (
    <div className="flex flex-col grow w-full px-6 py-10 max-w-3xl mx-auto">
      <Link href="/pools" className="tag-line flex items-center gap-2 hover:text-primary transition-colors">
        <ArrowLeftIcon className="h-3 w-3" /> back to the field
      </Link>

      {!isValid && <p className="text-error mt-8">That is not a valid address.</p>}

      {isValid && isLoading && <div className="neon-panel clip-corner h-64 mt-6 animate-pulse" />}

      {isValid && !isLoading && !pool && (
        <p className="text-error mt-8">
          The registry does not know this barrel.
          {error ? <span className="block text-xs opacity-60 mt-2">{error.message}</span> : null}
        </p>
      )}

      {pool && (
        <div className="neon-panel clip-corner p-8 mt-6 flex flex-col gap-7">
          <div>
            <span className={`tag-line flex items-center gap-2 ${kindOf(pool.kind).look.text}`}>
              {(() => {
                const Icona = kindOf(pool.kind).icon;
                return <Icona className="h-4 w-4" strokeWidth={1.5} />;
              })()}
              {pool.isPrime ? "prime barrel" : kindOf(pool.kind).tag}
            </span>
            <h1 className="text-4xl font-bold text-primary neon-text m-0 break-words">{pool.name}</h1>
          </div>

          <div className="flex flex-col gap-6 border-t border-primary/25 pt-6">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="tag-line">created by</span>
              <div className="min-w-0 overflow-x-auto">
                <Address address={pool.creator} format="long" size="sm" />
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <span className="tag-line">barrel contract</span>
              <div className="min-w-0 overflow-x-auto">
                <Address address={pool.poolAddress} format="long" size="sm" />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 border-t border-primary/25 pt-6">
              <div className="flex flex-col gap-2">
                <span className="tag-line">creation block</span>
                <span className="text-2xl font-bold text-secondary neon-text">#{pool.creationBlock.toString()}</span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="tag-line">balance</span>
                <Balance address={pool.poolAddress} />
              </div>
            </div>
          </div>
        </div>
      )}

      {pool && pool.kind === 1 && (
        <div className="mt-5 flex flex-col gap-5">
          {pool.shareNft !== "0x0000000000000000000000000000000000000000" && <ShareTitlePanel pool={pool} />}
          <PoolAavePanel pool={pool} onChange={refetch} />
        </div>
      )}

      {pool && pool.kind === 2 && (
        <div className="mt-5 flex flex-col gap-5">
          <TriggerPanel pool={pool} onChange={refetch} />
          <PoolAavePanel pool={pool} onChange={refetch} />
        </div>
      )}
    </div>
  );
};

export default PoolPage;
