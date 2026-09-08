"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { erc20Abi, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatAmount } from "~~/utils/amount";

/**
 * La pagina del CRUDE. Dice quello che dicono i contratti: quanti ne esistono,
 * quanti ne hai, da dove nascono. A cosa serviranno lo scriveremo qui.
 */
const Crude: NextPage = () => {
  const { address } = useAccount();
  const { data: token } = useScaffoldReadContract({ contractName: "PoolRegistry", functionName: "crudeToken" });
  const acceso = Boolean(token && token !== zeroAddress);

  const { data: simbolo } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: acceso },
  });
  const { data: totale } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: acceso },
  });
  const { data: mio } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: acceso && Boolean(address) },
  });

  return (
    <div className="flex flex-col grow w-full px-6 py-10 max-w-3xl mx-auto">
      <div className="flex items-center gap-5 border-b border-primary/30 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-14 w-14" />
        <div>
          <span className="tag-line">the token</span>
          <h1 className="text-4xl font-bold text-primary neon-text m-0">{simbolo ?? "CRUDE"}</h1>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mt-6">
        <div className="neon-panel clip-corner p-6 flex flex-col">
          <span className="tag-line">in circulation</span>
          <span className="text-3xl font-bold text-primary neon-text">{formatAmount(totale, 18)}</span>
        </div>
        <div className="neon-panel clip-corner p-6 flex flex-col">
          <span className="tag-line">yours</span>
          <span className="text-3xl font-bold text-secondary neon-text">{formatAmount(mio, 18)}</span>
        </div>
      </div>

      <div className="neon-panel clip-corner p-7 mt-6 flex flex-col gap-4">
        <span className="tag-line">where they come from</span>
        <p className="m-0 opacity-80">
          They are minted on the launch pad: the company put itself up for funding there, and the DAI backers send go
          straight into the prime barrel — the one named OIL COMPANY. Backers get CRUDE in return. Nothing else mints
          them.
        </p>
        <p className="m-0 opacity-80">
          CRUDE is not the same thing as a share of a barrel. Every barrel mints its own share token to whoever deposits
          in it, and the prime barrel also hands out a PRIME DAO NFT every 100 DAI. CRUDE is the coin of the company as
          a whole.
        </p>
        <p className="m-0 opacity-60 text-sm">What they are for is still being written. This page will say it.</p>
      </div>

      <Link href="/pools" className="tag-line mt-6 hover:text-primary transition-colors">
        the barrels →
      </Link>
    </div>
  );
};

export default Crude;
