import { ConditionReportRow } from "@/components/dashboard/bids/condition-report-row";
import { TelephoneBookingRow } from "@/components/dashboard/bids/telephone-booking-row";
import { ListSection } from "@/components/workspace/list-section";
import { ListLoadError } from "@/components/workspace/list-states";
import { mapBuyerConditionReportRequestsVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { getServerMyConditionReportRequests } from "@/lib/data/http/condition-report.server";
import { getServerMyTelephoneBookings } from "@/lib/data/http/telephone-booking.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { telephoneBookingRow } from "@/lib/telephone/telephone-booking-rows.vm";
import { RecordList } from "@auction/ui";

const TELEPHONE = {
  id: "telephone-bids",
  title: "Telephone bids",
  description: "Lines you booked to bid by phone in our saleroom sales.",
} as const;

const CONDITION_REPORTS = {
  id: "condition-reports",
  title: "Condition reports",
  description: "Reports you asked our specialists for. Download each one when it is ready.",
} as const;

async function settle<T>(read: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await read() };
  } catch {
    return { ok: false };
  }
}

/**
 * Telephone bookings, shown on My bids only when the person has made any. Most people never
 * book a line, so an always-present empty section would be noise.
 */
export async function TelephoneBidsSection() {
  const result = await settle(getServerMyTelephoneBookings);
  if (result.ok && result.value.length === 0) return null;
  // The bookings carry the sale id; name each sale when the booking does not.
  const titles = result.ok
    ? await resolveSaleTitles(result.value.filter((row) => !row.saleTitle).map((row) => row.saleId))
    : {};
  return (
    <ListSection {...TELEPHONE} {...(result.ok ? { count: result.value.length } : {})}>
      {result.ok ? (
        <RecordList aria-labelledby={TELEPHONE.id}>
          {result.value.map((row) => (
            <TelephoneBookingRow
              key={row.id}
              row={telephoneBookingRow({
                ...row,
                saleTitle: row.saleTitle || titles[row.saleId] || null,
              })}
            />
          ))}
        </RecordList>
      ) : (
        <ListLoadError />
      )}
    </ListSection>
  );
}

/** Condition report requests, shown on My bids only when the person has made any. */
export async function ConditionReportsSection() {
  const result = await settle(() => getServerMyConditionReportRequests(50, 0));
  const rows = result.ok ? mapBuyerConditionReportRequestsVM(result.value.items) : null;
  if (rows && rows.length === 0) return null;
  return (
    <ListSection {...CONDITION_REPORTS} {...(rows ? { count: rows.length } : {})}>
      {rows ? (
        <RecordList aria-labelledby={CONDITION_REPORTS.id}>
          {rows.map((row) => (
            <ConditionReportRow key={row.id} row={row} />
          ))}
        </RecordList>
      ) : (
        <ListLoadError />
      )}
    </ListSection>
  );
}
