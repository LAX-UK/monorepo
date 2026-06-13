import type { AdminQrCodeAnalyticsQuery } from "@/lib/actions/admin-qr-codes";
import type { DateRangeValue } from "@auction/ui/components/date-range-picker";
import { DEFAULT_AUCTION_ZONE, fromDateFormString } from "@auction/ui/lib/datetime";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";

/** Maps auction-zone calendar dates to a half-open UTC instant range [from, to). */
export function customDateRangeToAnalyticsQuery(range: DateRangeValue): AdminQrCodeAnalyticsQuery {
  const from = fromDateFormString(range.from, DEFAULT_AUCTION_ZONE).instant.toISOString();
  const toDayStart = fromDateFormString(range.to, DEFAULT_AUCTION_ZONE).instant;
  const toExclusive = addDays(new TZDate(toDayStart.getTime(), DEFAULT_AUCTION_ZONE), 1);
  return {
    from,
    to: new Date(toExclusive.getTime()).toISOString(),
  };
}
