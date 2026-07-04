import type {
  DateRange,
  ILotMetricsReader,
  IPaymentMetricsReader,
  IUserMetricsReader,
  LotMetricPoint,
  RevenueMetricPoint,
  UserMetricPoint,
} from "@auction/persistence/interfaces";

export type {
  DateRange,
  ILotMetricsReader,
  IPaymentMetricsReader,
  IUserMetricsReader,
  LotMetricPoint,
  RevenueMetricPoint,
  UserMetricPoint,
} from "@auction/persistence/interfaces";

export type AdminAnalyticsDashboard = {
  activeLots: number;
  lotCompletedSeries: LotMetricPoint[];
  conversion: { ended: number; withWinner: number };
  revenueSeries: RevenueMetricPoint[];
  averageOrderValue: string | null;
  registrationSeries: UserMetricPoint[];
  totalUsers: number;
  /** Last 7 points normalized 0–1 for sparklines (optional for older clients). */
  sparklines?: {
    revenue: readonly number[];
    lotCompleted: readonly number[];
    registrations: readonly number[];
  };
};

export interface IMetricsAggregator {
  aggregate(
    lot: ILotMetricsReader,
    payment: IPaymentMetricsReader,
    users: IUserMetricsReader,
    range: DateRange,
  ): Promise<AdminAnalyticsDashboard>;
}

export interface IAnalyticsService {
  getDashboard(range: DateRange): Promise<AdminAnalyticsDashboard>;
}
