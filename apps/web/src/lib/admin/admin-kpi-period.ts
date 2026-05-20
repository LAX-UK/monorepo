export type AdminKpiPeriodDays = 7 | 30 | 90;

const VALID: readonly AdminKpiPeriodDays[] = [7, 30, 90];

export function parseAdminKpiPeriod(raw: string | undefined): AdminKpiPeriodDays {
  const n = Number(raw);
  if (VALID.includes(n as AdminKpiPeriodDays)) return n as AdminKpiPeriodDays;
  return 30;
}

export function adminKpiPeriodLabel(days: AdminKpiPeriodDays): string {
  return `${days}d`;
}
