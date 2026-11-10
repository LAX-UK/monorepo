import { formatDateOfBirth } from "@/components/admin/people/staff-email-change-parts";
import { defaultQrAnalyticsCustomRange } from "@/components/admin/qr-code/use-qr-analytics";
import { dueWhen } from "@/lib/admin/consignment-inbox/inbox-presenters";
import { threadTime } from "@/lib/admin/consignment-inbox/thread-view";
import { dealHoldLine } from "@/lib/admin/data-requests/deal-holds";
import { customDateRangeToAnalyticsQuery } from "@/lib/admin/qr-analytics-range";
import { relativeFromIso } from "@/lib/admin/relative-time";
import {
  daysBefore,
  formatStaffCalendarDay,
  formatStaffDate,
  formatStaffDateTime,
  formatStaffDay,
  formatStaffExportDate,
  formatStaffRelative,
  formatStaffTime,
  londonToday,
  staffShortDateFormat,
} from "@auction/staff-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import golden from "./stage-b-snapshot.golden.json";
import { SWEEP_INSTANTS, SWEEP_NOW, SWEEP_ZONES } from "./stage-b-sweep";

/**
 * Stage B moves the staff surfaces (lib/admin, components/admin, packages/staff-ui) onto
 * `@auction/datetime` with no visible change. The golden strings were recorded from the code
 * before the move; this test renders the same paths afterwards and must pass unchanged.
 */
const SHORT_DATE_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: "numeric", month: "short" },
  dayMonthYear: { day: "numeric", month: "short", year: "numeric" },
  year2Digit: { year: "2-digit", month: "short", day: "numeric" },
  dayMonthTime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
};

const HOLD = (heldUntil: string | null) =>
  ({ dealReference: "D-1", status: "running", heldUntil }) as Parameters<typeof dealHoldLine>[0];

afterEach(() => vi.useRealTimers());

function renderSweep(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const iso of SWEEP_INSTANTS) {
    const date = new Date(iso);
    const later = new Date(date.getTime() + 26 * 3_600_000);
    const sameDayNow = new Date(date.getTime() + 3 * 3_600_000);
    const set = (name: string, value: string) => {
      out[`${name} ${iso}`] = value;
    };
    // packages/staff-ui: the staff formatters, London time.
    set("staffDate", formatStaffDate(iso, SWEEP_NOW));
    set("staffDateNextYear", formatStaffDate(iso, "2027-06-01T12:00:00Z"));
    set("staffDateTime", formatStaffDateTime(iso, SWEEP_NOW));
    set("staffTime", formatStaffTime(iso));
    set("staffTimeZone", formatStaffTime(iso, { zoneLabel: true }));
    set("exportDate", formatStaffExportDate(iso));
    set("relative", formatStaffRelative(iso, SWEEP_NOW));
    set("calendarDay", formatStaffCalendarDay(iso.slice(0, 10), SWEEP_NOW));
    set("fieldDay", formatStaffDay(iso.slice(0, 10)));
    set("londonToday", londonToday(date));
    set("daysBefore", `${daysBefore(iso.slice(0, 10), 6)} ${daysBefore(iso.slice(0, 10), 29)}`);
    // Sites that take a zone: the short-month formatter, in every zone.
    for (const zone of SWEEP_ZONES) {
      for (const [name, options] of Object.entries(SHORT_DATE_OPTIONS)) {
        set(
          `shortDate ${name} ${zone}`,
          staffShortDateFormat({ ...options, timeZone: zone }).format(date),
        );
      }
    }
    for (const [name, options] of Object.entries(SHORT_DATE_OPTIONS)) {
      set(`shortDate ${name} default`, staffShortDateFormat(options).format(date));
    }
    // apps/web lib/admin and components/admin.
    set("relativeFromIso", relativeFromIso(iso, SWEEP_NOW));
    for (const [label, now] of [
      ["now", SWEEP_NOW],
      ["next", later],
    ] as const) {
      const due = dueWhen(date, now);
      set(`dueWhen ${label}`, `${due.prefix} | ${due.text}`);
    }
    for (const [label, now] of [
      ["now", SWEEP_NOW],
      ["sameDay", sameDayNow],
    ] as const) {
      const t = threadTime(iso, now);
      set(`threadTime ${label}`, `${t.label} | ${t.full} | ${t.dateTime}`);
    }
    set("dealHold", dealHoldLine(HOLD(iso)).text);
    set("dateOfBirth", formatDateOfBirth(iso.slice(0, 10)));
    set("dateOfBirthBad", formatDateOfBirth("not-a-date"));
  }
  const range = (from: string, to: string) =>
    JSON.stringify(customDateRangeToAnalyticsQuery({ from, to }));
  for (const [from, to] of [
    ["2026-03-25", "2026-03-29"],
    ["2026-03-29", "2026-03-29"],
    ["2026-10-24", "2026-10-25"],
    ["2026-10-25", "2026-10-25"],
    ["2026-12-31", "2027-01-01"],
    ["2026-01-01", "2026-01-01"],
    ["2026-06-30", "2026-07-01"],
  ] as const) {
    out[`qrRange ${from} ${to}`] = range(from, to);
  }
  vi.useFakeTimers();
  for (const iso of SWEEP_INSTANTS) {
    vi.setSystemTime(new Date(iso));
    out[`qrDefaultRange ${iso}`] = JSON.stringify(defaultQrAnalyticsCustomRange());
  }
  vi.useRealTimers();
  return out;
}

describe("Stage B snapshot sweep", () => {
  const actual = renderSweep();

  const expected = golden as Record<string, string>;

  it("renders the same number of cases as were recorded", () => {
    expect(Object.keys(actual).length).toBe(Object.keys(expected).length);
    expect(Object.keys(actual).length).toBeGreaterThan(700);
  });

  it("renders every date and time string byte-for-byte as recorded", () => {
    const changed = Object.keys(expected).filter((key) => actual[key] !== expected[key]);
    expect(changed.map((k) => `${k}: ${actual[k]} != ${expected[k]}`)).toEqual([]);
  });
});
