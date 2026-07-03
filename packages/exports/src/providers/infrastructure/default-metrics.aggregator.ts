import type {
  AdminAnalyticsDashboard,
  DateRange,
  ILotMetricsReader,
  IMetricsAggregator,
  IPaymentMetricsReader,
  IUserMetricsReader,
} from "../ports/analytics.js";

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

    const last7 = (nums: number[]): readonly number[] => {
      const slice = nums.slice(-7);
      if (slice.length === 0) return [];
      const max = Math.max(...slice, 1e-9);
      return slice.map((x) => x / max);
    };
    const revenueNums = revenueSeries.map((r) => Number.parseFloat(r.total) || 0);
    const completedNums = lotCompletedSeries.map((r) => r.count);
    const regNums = registrationSeries.map((r) => r.count);

    return {
      activeLots,
      lotCompletedSeries,
      conversion,
      revenueSeries,
      averageOrderValue,
      registrationSeries,
      totalUsers,
      sparklines: {
        revenue: last7(revenueNums),
        lotCompleted: last7(completedNums),
        registrations: last7(regNums),
      },
    };
  }
}
