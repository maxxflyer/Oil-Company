"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { POOL_KINDS } from "~~/app/pools/_components/poolKind";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * Il manuale del giacimento: cosa fa ogni tipo di barile, in poche righe.
 * Chiuso, ogni tipo dice quanti barili di quella specie sono stati aperti.
 */
const Types: NextPage = () => {
  const { data: creationFee } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "creationFee",
  });
  const { data: assets } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "getAssets" });
  const { data: pools } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "getAllPools" });

  const quanti = (kind: number) => pools?.filter(pool => pool.kind === kind).length;

  return (
    <div className="flex flex-col grow w-full px-6 py-10 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-primary/30 pb-5">
        <div>
          <span className="tag-line">field manual</span>
          <h1 className="text-4xl font-bold text-primary neon-text m-0">Barrel Types</h1>
        </div>
        <span className="tag-line">
          opening one costs {creationFee === undefined ? "…" : `${formatEther(creationFee)} ETH`}
        </span>
      </div>

      <p className="opacity-70 mt-5">
        Every barrel is a contract of its own, opened by the registry. What it does depends on its type.
      </p>

      <div className="neon-panel neon-panel-accent clip-corner p-6 flex flex-col gap-3">
        <div>
          <span className="tag-line text-secondary">the first one</span>
          <h2 className="text-2xl font-bold text-secondary m-0">Prime Barrel</h2>
        </div>
        <p className="m-0 opacity-80 text-sm">
          The company&apos;s own barrel, open since the registry was deployed. It gathers the investors&apos; money in
          DAI and sends its surplus to an external mechanism that shares it out.
        </p>
        <p className="m-0 opacity-80 text-sm">
          Put money in and you get a <span className="text-secondary">PRIME DAO share</span> for every 100 DAI: an NFT
          that is your vote in the assembly running Oil Company. Shares are counted on everything you have ever put in,
          so giving one away does not earn you another. They can be sold or given, and the vote goes with them.
        </p>
        <p className="m-0 opacity-80 text-sm">
          Every other barrel pays it a tithe: on burn, 1% of the surplus goes to the Prime Barrel and 99% to the address
          that barrel chose. That 1% does not count as surplus there — it lands as principal, so it belongs to the
          investors and cannot be burned away. A tithe arriving in another token waits in the vault until someone
          converts it.
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {POOL_KINDS.map(kind => {
          const aperti = quanti(kind.value);
          const Icona = kind.icon;

          return (
            // Stesso `name`: il browser ne tiene aperto uno solo, senza scomodare React.
            <details key={kind.value} name="barrel-type" className={`neon-panel clip-corner group ${kind.look.soft}`}>
              <summary className="flex flex-wrap items-center justify-between gap-4 p-6 cursor-pointer list-none">
                <div className="flex items-center gap-4 min-w-0">
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
                  <Icona className={`h-8 w-8 shrink-0 ${kind.look.text}`} strokeWidth={1.25} />
                  <div className="min-w-0">
                    <span className={`tag-line ${kind.look.text}`}>{kind.tag}</span>
                    <h2 className={`text-2xl font-bold m-0 ${kind.look.text}`}>
                      {kind.label}
                      {kind.available ? null : <span className="ml-3 text-xs align-middle opacity-60">coming</span>}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-3xl font-bold text-primary neon-text">{aperti ?? "…"}</span>
                  <span className="tag-line">
                    {aperti === 1 ? "barrel in the registry" : "barrels in the registry"}
                  </span>
                </div>
              </summary>

              <div className="px-6 pb-6 flex flex-col gap-5">
                <p className="m-0 opacity-80 border-t border-primary/25 pt-5">{kind.blurb}</p>

                <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                  {kind.howItWorks.map(line => (
                    <li key={line} className="flex gap-3 text-sm">
                      <span className="text-primary shrink-0">▸</span>
                      <span className="opacity-80">{line}</span>
                    </li>
                  ))}
                </ul>

                {kind.subtypes.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-primary/25 pt-5">
                    <span className="tag-line">it comes in these flavours</span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {kind.subtypes.map(sub => {
                        const SubIcona = sub.icon;
                        return (
                          <div key={sub.label} className={`border p-3 flex gap-3 items-start ${kind.look.soft}`}>
                            <SubIcona className={`h-5 w-5 shrink-0 mt-0.5 ${kind.look.text}`} strokeWidth={1.5} />
                            <div className="min-w-0">
                              <span className="font-bold block text-sm">{sub.label}</span>
                              <span className="text-xs opacity-70 block mt-1">{sub.blurb}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {kind.needs.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-primary/25 pt-5">
                    <span className="tag-line">to open one you also pick</span>
                    <div className="flex flex-wrap gap-2">
                      {kind.needs.map(need => (
                        <span key={need} className="px-3 py-1 border border-primary/40 text-xs">
                          {need}
                        </span>
                      ))}
                    </div>
                    {assets?.length ? (
                      <span className="tag-line mt-1">
                        {assets.length} reserves on Aave right now: {assets.map(asset => asset.symbol).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <Link href="/pools" className="btn btn-primary mt-8 self-start">
        Back to the field
      </Link>
    </div>
  );
};

export default Types;
