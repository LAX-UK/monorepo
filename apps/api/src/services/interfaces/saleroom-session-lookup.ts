/** Narrow port for bid paths that must respect live saleroom floor control. */
export interface ISaleroomSessionLookup {
  /** When true, anti-sniping must not extend lot end — clerk hammer drives close. */
  shouldSkipAntiSnipeForLot(lotId: string): Promise<boolean>;
}
