"use client";

import Link from "next/link";
import { erc20Abi, zeroAddress } from "viem";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatAmount } from "~~/utils/amount";

/**
 * Quanti CRUDE ha in tasca chi è collegato.
 *
 * Il token nasce sul launch pad, quando la compagnia si mette in raccolta: il suo
 * indirizzo lo tiene il registro, e finché non c'è qui non si mostra niente.
 */
export const CrudeBalance = ({ address }: { address?: Address }) => {
  const { data: crude } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "crudeToken" });

  const { data: saldo } = useReadContract({
    address: crude,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && crude && crude !== zeroAddress) },
  });

  const { data: simbolo } = useReadContract({
    address: crude,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(crude && crude !== zeroAddress) },
  });

  if (!crude || crude === zeroAddress) return null;

  return (
    <Link
      href="/crude"
      className="flex items-center gap-2 text-[1.12em] font-bold text-primary hover:opacity-80 transition-opacity"
    >
      {/* La goccia è quella del sito: sta già in app/icon.svg. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-5 w-5" />
      <span className="[text-box:trim-both_cap_alphabetic]">
        {formatAmount(saldo, 18)} <span className="opacity-70">{simbolo ?? "CRUDE"}</span>
      </span>
    </Link>
  );
};
