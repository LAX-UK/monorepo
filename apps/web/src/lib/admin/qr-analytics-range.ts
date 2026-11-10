import { addCalendarDays } from "@auction/datetime";
import type { DateRangeValue } from "@auction/ui/components/date-range-picker";
import { DEFAULT_AUCTION_ZONE, fromDateFormString } from "@auction/ui/lib/datetime";
import type { QrCodeAnalyticsClientQuery } from "@auction/validators";

/** Maps auction-zone calendar dates to a half-open UTC instant range [from, to). */
export function customDateRangeToAnalyticsQuery(
  range: DateRangeValue,
): Extract<QrCodeAnalyticsClientQuery, { from: string }> {
  const from = fromDateFormString(range.from, DEFAULT_AUCTION_ZONE).instant.toISOString();
  const toDayStart = fromDateFormString(range.to, DEFAULT_AUCTION_ZONE).instant;
  const toExclusive = addCalendarDays(toDayStart, 1, DEFAULT_AUCTION_ZONE);
  return {
    from,
    to: toExclusive.toISOString(),
  };
}
