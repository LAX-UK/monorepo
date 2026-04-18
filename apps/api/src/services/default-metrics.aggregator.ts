import type {
  AdminAnalyticsDashboard,
  DateRange,
  ILotMetricsReader,
  IMetricsAggregator,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "./interfaces/analytics.js";

export class DefaultMetricsAggregator implements IMetricsAggregator {
  async aggregate(
    lot: ILotMetricsReader,
    payment: IPaymentMetricsReader,
    users: IUserMetricsReader,
    range: DateRange,
  ): Promise<AdminAnalyticsDashboard> {
    const [
      activeLots,
      lotCompletedSeries,
      conversion,
      revenueSeries,
      averageOrderValue,
      registrationSeries,
      totalUsers,
    ] = await Promise.all([
      lot.getActiveCount(),
      lot.getCompletedByDateRange(range),
      lot.getConversionRate(range),
      payment.getRevenueByDateRange(range),
      payment.getAverageOrderValue(range),
      users.getRegistrationsByDate(range),
      users.getActiveUserCount(),
    ]);

    return {
      activeLots,
      lotCompletedSeries,
      conversion,
      revenueSeries,
      averageOrderValue,
      registrationSeries,
      totalUsers,
    };
  }
}
