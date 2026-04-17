import type {
  AdminAnalyticsDashboard,
  DateRange,
  IAnalyticsService,
  IAuctionMetricsReader,
  IMetricsAggregator,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "./interfaces/analytics.js";

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private readonly auctionMetrics: IAuctionMetricsReader,
    private readonly paymentMetrics: IPaymentMetricsReader,
    private readonly userMetrics: IUserMetricsReader,
    private readonly aggregator: IMetricsAggregator,
  ) {}

  getDashboard(range: DateRange): Promise<AdminAnalyticsDashboard> {
    return this.aggregator.aggregate(
      this.auctionMetrics,
      this.paymentMetrics,
      this.userMetrics,
      range,
    );
  }
}
