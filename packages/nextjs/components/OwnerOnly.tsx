"use client";

import { ReactNode } from "react";
import { Address } from "@scaffold-ui/components";
import { useIsRegistryOwner } from "~~/hooks/useIsRegistryOwner";

/**
 * Lascia passare solo chi possiede il registro. Agli altri dice di chi è la chiave.
 */
export const OwnerOnly = ({ children }: { children: ReactNode }) => {
  const { owner, isOwner, isLoading } = useIsRegistryOwner();

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-10">
        <div className="neon-panel clip-corner h-64 animate-pulse" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-16 text-center">
        <span className="tag-line">control room</span>
        <h1 className="text-3xl font-bold text-error neon-text">Restricted</h1>
        <p className="opacity-70">This room opens only for whoever owns the registry.</p>
        {owner ? (
          <div className="flex justify-center mt-4">
            <Address address={owner} format="long" size="sm" />
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
};
