import type {
  QrCodeAnalyticsRange,
  QrCodeDailyAggregates,
  QrCodeRawAggregates,
} from "./qr-code-analytics.types.js";

export interface IQrCodeAnalyticsReader {
  fetchDailyAggregates(
    qrCodeId: string,
    range: QrCodeAnalyticsRange,
  ): Promise<QrCodeDailyAggregates>;

  fetchRawAggregates(qrCodeId: string, range: QrCodeAnalyticsRange): Promise<QrCodeRawAggregates>;
}
