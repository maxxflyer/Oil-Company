import { Banknote, BatteryCharging, Coins, MousePointerClick, Package, Scale, Send } from "lucide-react";

/**
 * I tipi di barile, negli stessi numeri del contratto PoolBase.
 *
 * Ognuno porta la sua icona e il suo colore: nella lista si riconoscono a colpo
 * d'occhio senza leggere l'etichetta. Le classi sono scritte per intero perché
 * Tailwind genera solo quelle che vede nel sorgente.
 */
export const POOL_KINDS = [
  {
    value: 0,
    label: "Base",
    tag: "barrel",
    icon: Package,
    look: {
      text: "text-primary",
      border: "border-primary",
      soft: "border-primary/40",
      fill: "bg-primary/10",
      chip: "border-primary bg-primary/10 text-primary",
    },
    available: true,
    blurb: "A bare barrel: a name, a creator, the block it was born in.",
    /// Quello che serve per aprirlo, oltre al nome.
    needs: [] as string[],
    /// Come funziona, in punti — la pagina Barrel Types mostra questi.
    howItWorks: [
      "Holds nothing but its own identity: name, creator, creation block.",
      "No deposits, no shares, no yield. It is the plain building block.",
      "Useful as a marker on chain, or as the starting point for a type that does more.",
    ],
    subtypes: [] as { value: number; label: string; icon: typeof Package; blurb: string; available: boolean }[],
  },
  {
    value: 1,
    label: "Aave Fund Barrel",
    tag: "fund barrel",
    icon: Banknote,
    look: {
      text: "text-secondary",
      border: "border-secondary",
      soft: "border-secondary/40",
      fill: "bg-secondary/10",
      chip: "border-secondary bg-secondary/10 text-secondary",
    },
    available: true,
    blurb:
      "Deposits go into Aave and earn. Depositors hold a share of the principal; the interest is the surplus, and burning it sends it to an address chosen at birth.",
    needs: ["a token to run on", "an address for the surplus"],
    howItWorks: [
      "Runs on one token, chosen at birth from Aave's own reserve list. It accepts deposits of that token and nothing else.",
      "Every deposit is supplied to Aave, which hands back aTokens to the barrel.",
      "Depositors receive shares. The barrel itself is an ERC20 and that token is the share — transfer it and the claim goes with it.",
      "Shares are counted against the principal alone, never the surplus: deposit a hundred today and you get the same shares you would have got on day one.",
      "The barrel remembers the principal deposited. Whatever sits above it is the surplus: the interest Aave has paid.",
      "The surplus belongs to nobody in the barrel. Burn sends all of it to the address chosen at birth and leaves the principal untouched. Anyone may press it — the destination is fixed and cannot be changed.",
      "Deposits are locked: for now there is no way to take the principal back out. The shares say what is yours, but nothing can be redeemed yet.",
      "Burning pays a tithe: 1% of the surplus goes to the Prime Barrel, the rest to the chosen address.",
    ],
    subtypes: [] as { value: number; label: string; icon: typeof Package; blurb: string; available: boolean }[],
  },
  {
    value: 2,
    label: "Aave Trigger Barrel",
    tag: "trigger barrel",
    icon: BatteryCharging,
    look: {
      text: "text-warning",
      border: "border-warning",
      soft: "border-warning/40",
      fill: "bg-warning/10",
      chip: "border-warning bg-warning/10 text-warning",
    },
    available: true,
    blurb:
      "A battery. It earns in Aave like a fund barrel, but the surplus is not sent away: it piles up until it can pay for a call to a contract chosen at birth. Then anyone can pull the trigger.",
    needs: ["a token to run on", "a contract and a call to pay for", "a bounty for whoever fires it"],
    howItWorks: [
      "Same engine as the fund barrel: deposits earn in Aave, shares stand for the principal, and only the surplus is ever spent.",
      "Target and calldata are fixed at birth. Nobody can point the money somewhere else, not even the creator.",
      "Gas is always paid by whoever signs the transaction, never by a contract — so the barrel pays a fixed bounty to whoever pulls the trigger. Too small and nobody pulls it; the size is set at birth.",
      "The trigger only fires when the surplus covers the whole shot: what the call costs, plus the bounty.",
      "The surplus is in tokens but gas and ETH are not, so the shot swaps just what it needs on the way out. The rest keeps earning.",
    ],
    subtypes: [
      {
        value: 0,
        label: "Plain call",
        icon: MousePointerClick,
        blurb: "Calls a function and attaches nothing. The whole cost is the bounty.",
        available: true,
      },
      {
        value: 1,
        label: "Call with ETH",
        icon: Send,
        blurb:
          "The function wants ETH: a mint, a donation, a renewal. The barrel buys exactly what it needs on Uniswap and unwraps it on the way out, so a shot costs whatever ETH costs today.",
        available: true,
      },
      {
        value: 2,
        label: "Call with tokens",
        icon: Coins,
        blurb: "The contract wants USDC or LINK: the barrel approves it, then calls.",
        available: false,
      },
      {
        value: 3,
        label: "Priced call",
        icon: Scale,
        blurb: "The cost is not known upfront — a bridge, an auction: the barrel asks the contract, then pays.",
        available: false,
      },
    ],
  },
] as const;

export const kindOf = (value: number) => POOL_KINDS.find(k => k.value === value) ?? POOL_KINDS[0];

/// Il sottotipo di un barile, se ne ha uno.
export const subtypeOf = (kind: number, subtype: number) => kindOf(kind).subtypes.find(s => s.value === subtype);

/// I sottotipi che si possono davvero aprire adesso.
export const openSubtypes = (kind: number) => kindOf(kind).subtypes.filter(s => s.available);

/// I tipi che si possono davvero aprire adesso.
export const OPEN_KINDS = POOL_KINDS.filter(kind => kind.available);
