export type DateRange = { start: Date; end: Date };

export type AuctionMetricPoint = { date: string; count: number };

export type RevenueMetricPoint = { date: string; total: string };

export type UserMetricPoint = { date: string; count: number };

export interface IAuctionMetricsReader {
  getActiveCount(): Promise<number>;
  getCompletedByDateRange(range: DateRange): Promise<AuctionMetricPoint[]>;
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

export type AdminAnalyticsDashboard = {
  activeAuctions: number;
  auctionCompletedSeries: AuctionMetricPoint[];
  conversion: { ended: number; withWinner: number };
  revenueSeries: RevenueMetricPoint[];
  averageOrderValue: string | null;
  registrationSeries: UserMetricPoint[];
  totalUsers: number;
};

export interface IMetricsAggregator {
  aggregate(
    auction: IAuctionMetricsReader,
    payment: IPaymentMetricsReader,
    users: IUserMetricsReader,
    range: DateRange,
  ): Promise<AdminAnalyticsDashboard>;
}

export interface IAnalyticsService {
  getDashboard(range: DateRange): Promise<AdminAnalyticsDashboard>;
}
