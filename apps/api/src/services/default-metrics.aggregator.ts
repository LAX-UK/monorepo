import type {
  AdminAnalyticsDashboard,
  DateRange,
  IAuctionMetricsReader,
  IMetricsAggregator,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "./interfaces/analytics.js";

export class DefaultMetricsAggregator implements IMetricsAggregator {
  async aggregate(
    auction: IAuctionMetricsReader,
    payment: IPaymentMetricsReader,
    users: IUserMetricsReader,
    range: DateRange,
  ): Promise<AdminAnalyticsDashboard> {
    const [
      activeAuctions,
      auctionCompletedSeries,
      conversion,
      revenueSeries,
      averageOrderValue,
      registrationSeries,
      totalUsers,
    ] = await Promise.all([
      auction.getActiveCount(),
      auction.getCompletedByDateRange(range),
      auction.getConversionRate(range),
      payment.getRevenueByDateRange(range),
      payment.getAverageOrderValue(range),
      users.getRegistrationsByDate(range),
      users.getActiveUserCount(),
    ]);

    return {
      activeAuctions,
      auctionCompletedSeries,
      conversion,
      revenueSeries,
      averageOrderValue,
      registrationSeries,
      totalUsers,
    };
  }
}
