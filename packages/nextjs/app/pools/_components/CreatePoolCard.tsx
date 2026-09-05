"use client";

import { PlusIcon } from "@heroicons/react/24/outline";

/**
 * La carta vuota in fondo all'elenco: apre il pannello per trivellare un barile nuovo.
 */
export const CreatePoolCard = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashed-panel clip-corner p-5 min-h-44 flex flex-col items-center justify-center gap-3 cursor-pointer"
    >
      <PlusIcon className="h-10 w-10 text-secondary" />
      <span className="tag-line text-secondary">new barrel</span>
    </button>
  );
};
