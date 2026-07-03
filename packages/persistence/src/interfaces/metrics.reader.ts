export type DateRange = { start: Date; end: Date };

export type LotMetricPoint = { date: string; count: number };

export type RevenueMetricPoint = { date: string; total: string };

export type UserMetricPoint = { date: string; count: number };

export interface ILotMetricsReader {
  getActiveCount(): Promise<number>;
  getCompletedByDateRange(range: DateRange): Promise<LotMetricPoint[]>;
  /** Ended with winner / total ended in range (simple conversion proxy). */
  getConversionRate(range: DateRange): Promise<{ ended: number; withWinner: number }>;
}

export interface IPaymentMetricsReader {
  getRevenueByDateRange(range: DateRange): Promise<RevenueMetricPoint[]>;
  getAverageOrderValue(range: DateRange): Promise<string | null>;
}

export interface IUserMetricsReader {
  getRegistrationsByDate(range: DateRange): Promise<UserMetricPoint[]>;
  getActiveUserCount(): Promise<number>;
}
