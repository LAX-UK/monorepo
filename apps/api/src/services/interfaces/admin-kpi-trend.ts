export type AdminKpiPeriodDays = 7 | 30 | 90;

export type AdminKpiTrendBundle = {
  currentTotal: number;
  priorTotal: number;
  dailyCounts: number[];
};

export interface IAdminKpiTrendService {
  getTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
}
