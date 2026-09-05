import { formatUnits } from "viem";

/**
 * I token hanno molti decimali: scritti per intero non si leggono.
 * Qui si mostrano come si mostrano i soldi, e sotto la soglia della polvere
 * — i wei rimasti dagli arrotondamenti — si scrive zero.
 */
export const formatAmount = (value: bigint | undefined, decimals = 18) => {
  if (value === undefined) return "…";

  const polvere = 10n ** BigInt(Math.max(0, decimals - 6));
  if (value < polvere) return "0.00";

  const n = Number(formatUnits(value, decimals));
  if (n < 0.01) return "< 0.01";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};
