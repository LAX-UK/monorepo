import "server-only";

import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminKpiTrendBundle = {
  currentTotal: number;
  priorTotal: number;
  dailyCounts: readonly number[];
};

function emptyKpiTrend(periodDays: AdminKpiPeriodDays): AdminKpiTrendBundle {
  return {
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: Array.from({ length: periodDays }, () => 0),
  };
}

async function fetchAdminKpiTrend(
  path: string,
  periodDays: AdminKpiPeriodDays,
  logLabel: string,
): Promise<AdminKpiTrendBundle> {
  try {
    const qs = new URLSearchParams({ periodDays: String(periodDays) });
    const res = await authedServerFetch(`${path}?${qs.toString()}`);
    if (!res.ok) throw new Error(`Failed to load ${logLabel} KPI trend: ${res.status}`);
    const body = (await res.json()) as { data?: AdminKpiTrendBundle };
    const data = body.data;
    if (!data) throw new Error(`Missing ${logLabel} KPI trend payload`);
    return {
      currentTotal: data.currentTotal,
      priorTotal: data.priorTotal,
      dailyCounts: [...data.dailyCounts],
    };
  } catch (err) {
    console.error(`[${logLabel}] Failed to load KPI trend:`, err);
    throw err;
  }
}

export async function getAdminClientsKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return emptyKpiTrend(periodDays);
}

export async function getAdminLotsKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/lots-trend", periodDays, "getAdminLotsKpiTrend");
}

/** Lots open for bidding on each day of the period. */
export async function getAdminLotsLiveKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/lots-live-trend", periodDays, "getAdminLotsLiveKpiTrend");
}

export async function getAdminLotsHammerKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend(
    "/admin/kpi/lots-hammer-trend",
    periodDays,
    "getAdminLotsHammerKpiTrend",
  );
}

export async function getAdminLotsEndedKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/lots-ended-trend", periodDays, "getAdminLotsEndedKpiTrend");
}

export async function getAdminSalesKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/sales-trend", periodDays, "getAdminSalesKpiTrend");
}

export async function getAdminPaymentsKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/payments-trend", periodDays, "getAdminPaymentsKpiTrend");
}

export async function getAdminPayoutsKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend("/admin/kpi/payouts-trend", periodDays, "getAdminPayoutsKpiTrend");
}

export async function getAdminSubmissionsKpiTrend(
  periodDays: AdminKpiPeriodDays,
): Promise<AdminKpiTrendBundle> {
  return fetchAdminKpiTrend(
    "/admin/kpi/submissions-trend",
    periodDays,
    "getAdminSubmissionsKpiTrend",
  );
}

export type AdminHomeKpiTrendsOptions = {
  includeSubmissions?: boolean;
  includePayments?: boolean;
  /** Lots open for bidding on each day, for the Live lots number. */
  includeLiveLots?: boolean;
};

export type AdminHomeKpiTrends = {
  lots: AdminKpiTrendBundle;
  submissions: AdminKpiTrendBundle;
  payments: AdminKpiTrendBundle;
  /** Lots open for bidding on each day; absent when not asked for or when it failed to load. */
  liveLots?: AdminKpiTrendBundle;
};

export async function getAdminHomeKpiTrends(
  periodDays: AdminKpiPeriodDays,
  options: AdminHomeKpiTrendsOptions = {},
): Promise<AdminHomeKpiTrends> {
  const includeSubmissions = options.includeSubmissions ?? false;
  const includePayments = options.includePayments ?? false;

  const [lots, submissions, payments, liveLots] = await Promise.all([
    getAdminLotsKpiTrend(periodDays),
    includeSubmissions
      ? getAdminSubmissionsKpiTrend(periodDays)
      : Promise.resolve(emptyKpiTrend(periodDays)),
    includePayments
      ? getAdminPaymentsKpiTrend(periodDays)
      : Promise.resolve(emptyKpiTrend(periodDays)),
    // A missing live series leaves the number without its trend rather than failing the rest.
    options.includeLiveLots
      ? getAdminLotsLiveKpiTrend(periodDays).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  return {
    lots,
    submissions,
    payments,
    ...(liveLots ? { liveLots } : {}),
  };
}
