/**
 * Which ended lots have no final public result yet: their winner did not pay and the lot is being
 * offered on, or it was re-awarded and the new buyer has not paid. Public pages show such a lot as
 * ended, with no price and no buyer.
 */
export interface IPublicLotResultReader {
  /** The ids, among `lotIds`, whose result is not final. Lots that are not ended never appear. */
  pendingAmong(lotIds: readonly string[]): Promise<ReadonlySet<string>>;
}
