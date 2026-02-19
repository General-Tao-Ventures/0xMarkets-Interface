// L1 gas reference is only needed for Arbitrum chains.
// Base does not use this mechanism, so we always return undefined.
export function useL1ExpressOrderGasReference() {
  return undefined;
}
