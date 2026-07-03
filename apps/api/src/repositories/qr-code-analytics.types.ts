export type QrCodeAnalyticsRange = {
  from: Date | null;
  to: Date;
};

export type QrCodeBreakdownAggregateRow = {
  key: string | null;
  scans: number;
};

export type QrCodeDailyTrendRow = {
  bucketAt: Date;
  scans: number;
};

export type QrCodeDailyAggregates = {
  total: number;
  trend: QrCodeDailyTrendRow[];
  device: QrCodeBreakdownAggregateRow[];
  country: QrCodeBreakdownAggregateRow[];
};

export type QrCodeRawTrendRow = {
  bucketAt: Date;
  scans: number;
};

export type QrCodeRawRecentScanRow = {
  scannedAt: Date;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  referrerHost: string | null;
};

export type QrCodeRawAggregates = {
  total: number;
  uniqueIps: number;
  trend: QrCodeRawTrendRow[];
  device: QrCodeBreakdownAggregateRow[];
  country: QrCodeBreakdownAggregateRow[];
  browser: QrCodeBreakdownAggregateRow[];
  os: QrCodeBreakdownAggregateRow[];
  referrer: QrCodeBreakdownAggregateRow[];
  recent: QrCodeRawRecentScanRow[];
};
