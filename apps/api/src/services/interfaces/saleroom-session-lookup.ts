/** Narrow port for bid paths that must respect live saleroom floor control. */
export interface ISaleroomSessionLookup {
  /** When true, anti-sniping must not extend lot end — clerk hammer drives close. */
  shouldSkipAntiSnipeForLot(lotId: string): Promise<boolean>;
  /** When true, web bids must pass saleroom live + on-block checks. */
  shouldEnforceOnBlockGateForLot(lotId: string): Promise<boolean>;
  /** When true, timed lot-close jobs must defer — clerk session drives close. */
  isLotUnderLiveClerkSession(lotId: string): Promise<boolean>;
}
