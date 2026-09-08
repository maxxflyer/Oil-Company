"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OPEN_KINDS, openSubtypes } from "./poolKind";
import { AddressInput } from "@scaffold-ui/components";
import { formatEther, isAddress, parseEther, parseEventLogs, parseUnits, toFunctionSelector, zeroAddress } from "viem";
import type { Address as AddressType } from "viem";
import { useAccount } from "wagmi";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

/**
 * Il pannello di trivellazione: nome, tipo, e per i barili di tipo 1 anche il token
 * su cui lavorano e l'indirizzo a cui andrà il surplus.
 * A conferma avvenuta si va dritti sulla pagina del barile appena aperto.
 */
export const CreatePoolModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<number>(1);
  const [asset, setAsset] = useState<AddressType | "">("");
  const [beneficiary, setBeneficiary] = useState("");
  const [target, setTarget] = useState("");
  const [call, setCall] = useState("");
  const [bounty, setBounty] = useState("");
  const [flavour, setFlavour] = useState(0);
  const [ethValue, setEthValue] = useState("");
  const router = useRouter();
  const { address } = useAccount();

  const { data: registry } = useDeployedContractInfo({ contractName: "PoolRegistry" });
  const { data: creationFee } = useScaffoldReadContract({
    contractName: "PoolRegistry",
    functionName: "creationFee",
  });
  const { data: assets } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "getAssets" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "PoolRegistry" });

  // Il primo token disponibile e il proprio indirizzo sono i valori di partenza sensati.
  useEffect(() => {
    if (!asset && assets?.length) setAsset(assets[0].token);
  }, [assets, asset]);
  useEffect(() => {
    if (!beneficiary && address) setBeneficiary(address);
  }, [address, beneficiary]);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const isFund = kind === 1;
  const isTrigger = kind === 2;
  const suAave = isFund || isTrigger;
  const scelto = assets?.find(option => option.token === asset);

  /// Il campo accetta una firma — `poke()` — oppure la calldata già pronta.
  const calldataDa = (testo: string) => {
    const pulito = testo.trim();
    if (!pulito) return undefined;
    if (pulito.startsWith("0x"))
      return pulito.length > 2 && pulito.length % 2 === 0 ? (pulito as `0x${string}`) : undefined;
    try {
      return toFunctionSelector(pulito);
    } catch {
      return undefined;
    }
  };
  const dati = calldataDa(call);

  const bountyWei = (() => {
    try {
      return parseUnits(bounty || "0", scelto?.decimals ?? 18);
    } catch {
      return -1n;
    }
  })();

  const puoScavare =
    Boolean(name.trim()) &&
    creationFee !== undefined &&
    (!suAave || Boolean(asset)) &&
    (!isFund || isAddress(beneficiary)) &&
    (!isTrigger || (isAddress(target) && Boolean(dati) && bountyWei >= 0n));

  const drill = async () => {
    if (!puoScavare) return;

    const variables = isTrigger
      ? ({
          functionName: "createTriggerBarrel",
          args: [
            name.trim(),
            asset as AddressType,
            {
              flavour,
              target: target as AddressType,
              callData: dati!,
              bounty: bountyWei,
              ethValue: flavour === 1 ? parseEther(ethValue || "0") : 0n,
            },
          ],
          value: creationFee,
        } as const)
      : ({
          functionName: "createPool",
          args: [
            name.trim(),
            kind,
            isFund ? (asset as AddressType) : zeroAddress,
            isFund ? (beneficiary as AddressType) : zeroAddress,
          ],
          value: creationFee,
        } as const);

    await writeContractAsync(variables, {
      onBlockConfirmation: receipt => {
        onCreated();
        if (!registry?.abi) return;
        const events = parseEventLogs({ abi: registry.abi, eventName: "PoolCreated", logs: receipt.logs });
        const created = events[0]?.args as { poolAddress?: AddressType } | undefined;
        if (created?.poolAddress) router.push(`/pools/${created.poolAddress}`);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-200/80 overflow-y-auto">
      <div className="neon-panel neon-panel-accent clip-corner w-full max-w-md p-6 flex flex-col gap-5 my-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <span className="tag-line text-secondary">drilling rig</span>
            <h3 className="text-2xl font-bold text-secondary neon-text m-0">New barrel</h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-2" aria-label="close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="tag-line">barrel name</span>
          <input
            autoFocus
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Sector-7 Crude"
            className="input input-bordered w-full bg-base-200 border-secondary/50 focus:border-secondary focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="tag-line">barrel type</span>
          <div className="grid gap-2">
            {OPEN_KINDS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`text-left p-3 border transition-colors flex gap-3 items-start ${
                  kind === option.value ? option.look.chip : "border-primary/30 hover:border-primary/70"
                }`}
              >
                <option.icon className="h-5 w-5 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span className="min-w-0">
                  <span className="font-bold block">{option.label}</span>
                  <span className="text-xs opacity-70 block mt-1">{option.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {suAave && (
          <>
            <div className="flex flex-col gap-2">
              <span className="tag-line">barrel token</span>
              <select
                value={asset}
                onChange={event => setAsset(event.target.value as AddressType)}
                className="select select-bordered w-full bg-base-200 border-primary/50 focus:border-primary focus:outline-none font-bold"
              >
                {assets?.length ? null : <option value="">loading Aave reserves…</option>}
                {assets?.map(option => (
                  <option key={option.token} value={option.token}>
                    {option.symbol}
                  </option>
                ))}
              </select>
              <span className="tag-line">
                {assets?.length ? `${assets.length} reserves on Aave` : "reading from Aave"} · the barrel will accept
                this token only
              </span>
            </div>

            {isFund && (
              <div className="flex flex-col gap-2">
                <span className="tag-line">surplus goes to</span>
                <AddressInput value={beneficiary} onChange={setBeneficiary} placeholder="0x…" />
              </div>
            )}

            {isTrigger && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="tag-line">what the call needs</span>
                  <div className="grid gap-2">
                    {openSubtypes(2).map(sub => (
                      <button
                        key={sub.value}
                        type="button"
                        onClick={() => setFlavour(sub.value)}
                        className={`text-left p-3 border transition-colors flex gap-3 items-start ${
                          flavour === sub.value
                            ? "border-warning bg-warning/10 text-warning"
                            : "border-primary/30 hover:border-primary/70"
                        }`}
                      >
                        <sub.icon className="h-5 w-5 shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span className="min-w-0">
                          <span className="font-bold block">{sub.label}</span>
                          <span className="text-xs opacity-70 block mt-1">{sub.blurb}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {flavour === 1 && (
                  <label className="flex flex-col gap-2">
                    <span className="tag-line">ETH to attach to each call</span>
                    <input
                      inputMode="decimal"
                      value={ethValue}
                      onChange={event => setEthValue(event.target.value.replace(",", "."))}
                      placeholder="0.1"
                      className="input input-bordered w-full bg-base-200 border-warning/50 focus:border-warning focus:outline-none"
                    />
                    <span className="tag-line">
                      bought on Uniswap at firing time · a shot costs whatever that much ETH costs then
                    </span>
                  </label>
                )}

                <div className="flex flex-col gap-2">
                  <span className="tag-line">contract to call</span>
                  <AddressInput value={target} onChange={setTarget} placeholder="0x…" />
                </div>

                <label className="flex flex-col gap-2">
                  <span className="tag-line">function to call</span>
                  <input
                    value={call}
                    onChange={event => setCall(event.target.value)}
                    placeholder="poke()"
                    className="input input-bordered w-full bg-base-200 border-warning/50 focus:border-warning focus:outline-none"
                  />
                  <span className="tag-line">
                    a signature like poke(), or raw calldata starting with 0x{dati ? ` · ${dati.slice(0, 10)}` : ""}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="tag-line">bounty for whoever fires it</span>
                  <input
                    inputMode="decimal"
                    value={bounty}
                    onChange={event => setBounty(event.target.value.replace(",", "."))}
                    placeholder="2"
                    className="input input-bordered w-full bg-base-200 border-warning/50 focus:border-warning focus:outline-none"
                  />
                  <span className="tag-line">
                    paid in {scelto?.symbol ?? "the barrel token"} · it has to be worth more than the gas, or nobody
                    pulls it
                  </span>
                </label>
              </>
            )}
          </>
        )}

        <div className="flex items-center justify-between text-sm border-t border-primary/25 pt-4">
          <span className="tag-line">opening cost</span>
          <span className="text-primary neon-text font-bold">
            {creationFee === undefined ? "…" : `${formatEther(creationFee)} ETH`}
          </span>
        </div>

        <button type="button" onClick={drill} disabled={!puoScavare || isMining} className="btn btn-secondary w-full">
          {isMining ? <span className="loading loading-spinner loading-sm" /> : "Create barrel"}
        </button>
      </div>
    </div>
  );
};
