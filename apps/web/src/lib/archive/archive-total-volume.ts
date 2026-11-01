import { formatKpiMoney } from "@/lib/ui/format";

/**
 * The archive's headline figure: the hammer total of sold lots in sterling, compact above
 * £100,000 ("£5.6m"). Null when nothing has sold, so the page never shows a bare zero.
 */
export function archiveTotalVolumeLabel(totalHammer: string): string | null {
  const n = Number.parseFloat(totalHammer);
  if (!Number.isFinite(n) || n <= 0) return null;
  return formatKpiMoney(n);
}
