import { windowHeading } from "@/lib/collect/collect-calendar";
import { seasonRows } from "@/lib/marketing-cover/bid-between-seasons";
import { resultsYears } from "@/lib/marketing/results-page.vm";
import type { SaleListRow } from "@/lib/sale-list-row";
import { formatOgDateTime } from "@/lib/seo/og-date-format";
import {
  dayKey,
  dayOffset,
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatFullMoment,
  formatMoment,
  formatMonthYear,
  formatTime,
  formatTimeWithZone,
  formatWeekday,
  formatWhen,
  shortZoneName,
} from "@auction/datetime";
import type { CollectionDayView } from "@auction/types";
import { describe, expect, it } from "vitest";
import golden from "./stage-a-snapshot.golden.json";
import { SWEEP_INSTANTS, SWEEP_NOW, SWEEP_ZONES } from "./stage-a-sweep";

/**
 * Stage A moves the Bid public and client pages onto `@auction/datetime` with no visible change.
 * The golden strings were recorded from the code before the move; this test renders the same
 * paths afterwards and must pass unchanged.
 */
type Render = (date: Date, zone: string) => string;

const MOMENT_FORMS: Record<string, Render> = {
  when: (d, z) => formatWhen(d, z, SWEEP_NOW),
  time: (d, z) => formatTime(d, z),
  timeWithZone: (d, z) => formatTimeWithZone(d, z),
  zoneName: (d, z) => shortZoneName(z, d),
  dayKey: (d, z) => dayKey(d, z),
  date: (d, z) => formatDate(d, z),
  dateLong: (d, z) => formatDate(d, z, { month: "long" }),
  fullMoment: (d, z) => formatFullMoment(d, z),
  monthYear: (d, z) => formatMonthYear(d, z),
  monthYearShort: (d, z) => formatMonthYear(d, z, { short: true }),
  weekday: (d, z) => formatWeekday(d, z),
  dayMonth: (d, z) => formatDayMonth(d, z, SWEEP_NOW),
  dayOffset: (d, z) => String(dayOffset(d, SWEEP_NOW, z)),
  moment: (d, z) => formatMoment(d, z, SWEEP_NOW),
  momentDateOnly: (d, z) => formatMoment(d, z, SWEEP_NOW, { time: false, inSentence: true }),
  range: (d, z) =>
    `${formatDateRange(d, new Date(d.getTime() + 3 * 86_400_000 + 3_600_000), z)} | ${formatDateRange(d, new Date(d.getTime() + 40 * 86_400_000), z)}`,
};

const days = (...dates: string[]): CollectionDayView[] =>
  dates.map((date) => ({ date, state: "open", openSlots: 1, slots: [] }));

/** Every path the migrated files render through, by name. Keys are the golden's keys. */
function renderSweep(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const zone of SWEEP_ZONES) {
    for (const iso of SWEEP_INSTANTS) {
      const date = new Date(iso);
      for (const [name, render] of Object.entries(MOMENT_FORMS)) {
        out[`${name} ${zone} ${iso}`] = render(date, zone);
      }
    }
  }
  // Site-level paths that carry their own zone choice today.
  for (const iso of SWEEP_INSTANTS) out[`og ${iso}`] = formatOgDateTime(new Date(iso));
  for (const [i, set] of [
    days("2026-11-30", "2026-12-01"),
    days("2026-12-30", "2027-01-02"),
    days("2026-10-03", "2026-10-09"),
    days("2026-09-29"),
  ].entries()) {
    out[`windowHeading ${i}`] = windowHeading(set);
  }
  const row = (endedAt: string) =>
    ({
      lotCount: 3,
      resultsSummary: { state: "final", endedAt },
      sale: { endTime: endedAt },
    }) as unknown as SaleListRow;
  out.resultsYears = JSON.stringify(resultsYears(SWEEP_INSTANTS.map(row)));
  out.seasonRows = JSON.stringify(
    seasonRows({
      consignmentDeadline: new Date("2026-12-20T12:00:00Z"),
      nextSales: SWEEP_INSTANTS.map((iso) => ({ title: iso, startsAt: new Date(iso) })).filter(
        (s) => s.startsAt > SWEEP_NOW,
      ),
      now: SWEEP_NOW,
    }),
  );
  return out;
}

describe("Stage A snapshot sweep", () => {
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
