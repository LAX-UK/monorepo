/** The event a published sale leaves for the alert matcher. */
export type SalePublishedEvent = {
  saleId: string;
  /** Staff left "Announce" ticked. Events from before the box existed announce. */
  announce: boolean;
  lotCount: number | null;
};

/** The event a published lot leaves for the artist and saved-search matchers. */
export type LotPublishedEvent = {
  lotId: string;
};

/** What the matching projector needs from the Bid alert runtime. */
export type BidAlertMatching = {
  /** True once the seed ran, so nothing already published is announced. */
  isSeeded(): Promise<boolean>;
  /** The event position lot matching began at; lot events up to it are not matched. */
  lotStart(): Promise<number>;
  handle(event: SalePublishedEvent): Promise<unknown>;
  /** Matches a batch of published lots against followed artists and saved searches. */
  handleLots(events: readonly LotPublishedEvent[]): Promise<unknown>;
};
