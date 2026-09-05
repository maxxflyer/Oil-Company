import React from "react";
import { Skull } from "lucide-react";
import { hardhat } from "viem/chains";
import { HeartIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Site footer
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div>
        <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <div className="pointer-events-auto" />
          <div
            className={`flex items-center gap-1 pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`}
          >
            <SwitchTheme />
          </div>
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-2 text-sm w-full">
            <div className="flex justify-center items-center gap-2">
              <p className="m-0 text-center">
                Built with <HeartIcon className="inline-block h-4 w-4" /> by maxxflyer{" "}
                <Skull className="inline-block h-4 w-4 align-text-bottom" strokeWidth={1.5} />{" "}
                {/* La porta del Discord è la scritta stessa: non serve una seconda voce. */}
                <a href="https://discord.gg/eCK6QAPTT" target="_blank" rel="noreferrer" className="link">
                  cypherparty
                </a>
              </p>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
