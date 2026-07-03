/** Mirrors {@link import("@auction/queues").QrCodeScanJobPayload} without a queues dependency. */
export type QrCodeScanInput = {
  qrCodeId: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  requestId?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
};

export interface IQrCodeScanPersister {
  persist(input: QrCodeScanInput): Promise<void>;
}
