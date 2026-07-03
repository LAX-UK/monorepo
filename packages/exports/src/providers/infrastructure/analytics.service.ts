import type {
  AdminAnalyticsDashboard,
  DateRange,
  IAnalyticsService,
  ILotMetricsReader,
  IMetricsAggregator,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "../ports/analytics.js";

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private readonly lotMetrics: ILotMetricsReader,
    private readonly paymentMetrics: IPaymentMetricsReader,
    private readonly userMetrics: IUserMetricsReader,
    private readonly aggregator: IMetricsAggregator,
  ) {}

  getDashboard(range: DateRange): Promise<AdminAnalyticsDashboard> {
    return this.aggregator.aggregate(this.lotMetrics, this.paymentMetrics, this.userMetrics, range);
  }
}
