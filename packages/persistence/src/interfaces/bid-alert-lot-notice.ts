/** An in-app notice about new lots: what the person reads, and the site page it opens. */
export type BidAlertLotNotice = {
  type: "artist_lots_listed" | "search_lots_listed";
  title: string;
  message: string;
  linkPath: string;
};

export interface IBidAlertLotNoticeWriter {
  /**
   * Writes a digest's notices for one account. Idempotent per digest and type, so assembling the
   * same digest again adds nothing, and a notice whose app switch is off is not written.
   * Returns how many were written.
   */
  write(input: {
    digestId: string;
    userId: string;
    notices: readonly BidAlertLotNotice[];
  }): Promise<number>;
}
