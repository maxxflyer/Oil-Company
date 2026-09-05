import type { Address as AddressType } from "viem";

/** Un barile come lo racconta il registro. */
export type PoolInfo = {
  poolAddress: AddressType;
  name: string;
  creator: AddressType;
  creationBlock: bigint;
  kind: number;
  isPrime: boolean;
  asset: AddressType;
  assetSymbol: string;
  assetDecimals: number;
  beneficiary: AddressType;
  principal: bigint;
  totalAssets: bigint;
  surplus: bigint;
  /// Solo per i barili a grilletto.
  target: AddressType;
  bounty: bigint;
  shotCost: bigint;
  shots: bigint;
  subtype: number;
  ethValue: bigint;
  /// Il titolo che il barile consegna a chi versa, e ogni quanto.
  shareNft: AddressType;
  shareNftEvery: bigint;
};
