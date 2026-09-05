"use client";

import { POOL_KINDS } from "./poolKind";
import { Layers } from "lucide-react";

/**
 * La barra per guardare un tipo di barile alla volta: tessere con l'icona sopra e
 * quanti ce ne sono sotto. Il nome sta nel tooltip — a colpo d'occhio bastano la
 * forma e il colore.
 *
 * `null` vuol dire tutti.
 */
export const KindFilter = ({
  value,
  onChange,
  counts,
}: {
  value: number | null;
  onChange: (kind: number | null) => void;
  counts: Record<number, number>;
}) => {
  const tutti = Object.values(counts).reduce((somma, quanti) => somma + quanti, 0);

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        title="All barrels"
        onClick={() => onChange(null)}
        className={`w-20 h-20 border flex flex-col items-center justify-center gap-1 transition-colors ${
          value === null
            ? "border-primary bg-primary/20 text-primary"
            : "border-primary/25 bg-primary/5 text-primary/50 hover:text-primary hover:border-primary/60"
        }`}
      >
        <Layers className="h-7 w-7" strokeWidth={1.25} />
        <span className="text-lg font-bold leading-none">{tutti}</span>
      </button>

      {POOL_KINDS.map(kind => {
        const Icona = kind.icon;
        const quanti = counts[kind.value] ?? 0;
        const acceso = value === kind.value;

        return (
          <button
            key={kind.value}
            type="button"
            title={kind.label}
            onClick={() => onChange(kind.value)}
            disabled={quanti === 0}
            className={`w-20 h-20 border flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-25 ${
              kind.look.text
            } ${acceso ? `${kind.look.border} ${kind.look.fill}` : `${kind.look.soft} opacity-60 hover:opacity-100`}`}
          >
            <Icona className="h-7 w-7" strokeWidth={1.25} />
            <span className="text-lg font-bold leading-none">{quanti}</span>
          </button>
        );
      })}
    </div>
  );
};
