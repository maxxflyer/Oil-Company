"use client";

import { useState } from "react";

/**
 * Il logo di un token. I file stanno in `public/tokens`, presi dalla raccolta
 * cryptocurrency-icons (CC0). Per quelli che non ci sono resta una pastiglia
 * con la sigla: meglio di un buco.
 */
export const TokenIcon = ({ symbol, className = "h-5 w-5" }: { symbol: string; className?: string }) => {
  const [mancante, setMancante] = useState(false);
  const nome = symbol.toLowerCase();

  if (mancante) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full border border-primary/40 text-[0.5rem] font-bold text-primary/80`}
        title={symbol}
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/tokens/${nome}.svg`}
      alt={symbol}
      title={symbol}
      className={`${className} inline-block`}
      onError={() => setMancante(true)}
    />
  );
};
