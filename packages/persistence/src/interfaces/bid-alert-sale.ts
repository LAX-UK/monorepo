/** The sale behind a new-sale alert, as the alert needs it. */
export type AnnouncedSale = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  /** The sale's own zone: the clock its times are official in. */
  timeZone: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  deliveryMode: "online" | "onsite" | "hybrid";
  /** A test sale is never announced. */
  isTest: boolean;
};

export interface IBidAlertSaleReader {
  find(saleId: string): Promise<AnnouncedSale | null>;
}

export interface IBidAlertSaleNoticeWriter {
  /** Idempotent: a person is told once per sale. Returns how many notices were written. */
  notifySubscribers(input: { saleId: string; title: string; message: string }): Promise<number>;
}
