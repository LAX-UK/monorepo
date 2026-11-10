/**
 * Stage C moves the date formatting of LAX Shop, lax.art, LAX Account, auth, api, worker, alerts
 * and the event app onto this package without changing a character. Each row is one call site:
 * `old` is that site's formatter exactly as it was written, `next` is the call it became. The
 * golden file was recorded from `old` before any site moved; `next` must still produce it.
 */
import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDayMonthOnly,
  formatTimeUnpadded,
  formatWeekdayDate,
  formatWeekdayDateTime,
  formatWeekdayDayMonth,
  runtimeTimeZone,
} from "./calendar-formats.js";
import {
  formatDate,
  formatTime,
  formatTimeWithZone,
  formatWeekday,
  formatWhen,
} from "./date-style.js";
import { dayKey } from "./day.js";
import { STAGE_C_INSTANTS } from "./testing/stage-c-instants.js";
import { instantToWallClock } from "./wall-clock.js";

const LONDON = "Europe/London";
const I = (timeZone: string | undefined, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", timeZone ? { timeZone, ...options } : options);
const KEY = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const SEPT = { engineSept: true };
const NOW = new Date("2026-11-10T09:00:00Z");

/** apps/account/src/lib/format-date.ts, as written. */
const ACCOUNT_PARTS = I(LONDON, {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function accountParts(date: Date) {
  const found: Record<string, string> = {};
  for (const part of ACCOUNT_PARTS.formatToParts(date)) found[part.type] = part.value;
  return {
    weekday: found.weekday ?? "",
    day: String(Number(found.day)),
    month: MONTHS[Number(found.month) - 1] ?? "",
    year: found.year ?? "",
    time: `${found.hour}:${found.minute}`,
    zone: found.timeZoneName ?? "",
  };
}
function accountDate(date: Date) {
  const p = accountParts(date);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}
function accountDateTime(date: Date, now: Date) {
  const p = accountParts(date);
  const sameYear = accountParts(now).year === p.year;
  return `${p.weekday} ${p.day} ${p.month}${sameYear ? "" : ` ${p.year}`}, ${p.time} ${p.zone}`;
}

/** packages/alerts/src/domain/london-date.ts, as written. */
const DIGEST = I(LONDON, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
function digestParts(now: Date) {
  const get = (type: string) => DIGEST.formatToParts(now).find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${Number(get("hour"))}`;
}

/** apps/worker/src/alerts/sale-snapshot.ts, as written. */
function saleSnapshotDay(at: Date) {
  const parts = I(LONDON, { weekday: "short", day: "numeric", month: "short" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** apps/shop/src/lib/checkout/checkout-delivery.ts `londonToday`, as written. */
function checkoutToday(now: Date) {
  const parts = I(LONDON, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"))).toISOString();
}

type Site = { site: string; old: (d: Date) => string; next: (d: Date) => string };
const date = (zone: string | undefined, options: Intl.DateTimeFormatOptions) => (d: Date) =>
  I(zone, options).format(d);
const LONG = { day: "numeric", month: "long", year: "numeric" } as const;
const SHORT = { day: "numeric", month: "short", year: "numeric" } as const;
const SHORT_TIME = { ...SHORT, hour: "2-digit", minute: "2-digit" } as const;
const runtime = () => runtimeTimeZone();

const SITES: Site[] = [
  {
    site: "account formatDate",
    old: accountDate,
    next: (d) => `${formatWeekday(d, LONDON)} ${formatDate(d, LONDON)}`,
  },
  {
    site: "account formatTime",
    old: (d) => `${accountParts(d).time} ${accountParts(d).zone}`,
    next: (d) => formatTimeWithZone(d, LONDON),
  },
  {
    site: "account formatDateTime",
    old: (d) => accountDateTime(d, NOW),
    next: (d) => formatWhen(d, LONDON, NOW),
  },
  {
    site: "alerts digest date and hour",
    old: digestParts,
    next: (d) => `${dayKey(d, LONDON)} ${Number(instantToWallClock(d, LONDON).time.slice(0, 2))}`,
  },
  {
    site: "api email closesAt",
    old: date(LONDON, SHORT_TIME),
    next: (d) => formatDateTime(d, LONDON, SEPT),
  },
  {
    site: "api staff role last day / ended on / payment due / deal due",
    old: date(LONDON, LONG),
    next: (d) => formatDate(d, LONDON, { month: "long" }),
  },
  {
    site: "api admin relative time (UTC)",
    old: date("UTC", SHORT),
    next: (d) => formatDate(d, "UTC", { month: "short", ...SEPT }),
  },
  {
    site: "art application date",
    old: date(LONDON, LONG),
    next: (d) => formatDate(d, LONDON, { month: "long" }),
  },
  {
    site: "art editorial card day month (UTC)",
    old: date("UTC", { day: "numeric", month: "short" }),
    next: (d) => formatDayMonthOnly(d, "UTC", SEPT),
  },
  {
    site: "art editorial card day month year / story date (UTC)",
    old: date("UTC", SHORT),
    next: (d) => formatDate(d, "UTC", { month: "short", ...SEPT }),
  },
  {
    site: "art editorial day key",
    old: (d) => KEY(LONDON).format(d),
    next: (d) => dayKey(d, LONDON),
  },
  {
    site: "art exhibition long date (UTC)",
    old: date("UTC", LONG),
    next: (d) => formatDate(d, "UTC", { month: "long" }),
  },
  {
    site: "auth london time",
    old: (d) =>
      `${I(LONDON, LONG).format(d)} at ${I(LONDON, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).format(d)}`,
    next: (d) => `${formatDate(d, LONDON, { month: "long" })} at ${formatTimeWithZone(d, LONDON)}`,
  },
  {
    site: "event seo / event date",
    old: date(LONDON, { weekday: "long", ...LONG }),
    next: (d) => formatWeekdayDate(d, LONDON),
  },
  {
    site: "event doors time",
    old: date(LONDON, { hour: "numeric", minute: "2-digit" }),
    next: (d) => formatTimeUnpadded(d, LONDON),
  },
  {
    site: "event pass date",
    old: date(LONDON, { weekday: "long", day: "numeric", month: "long" }),
    next: (d) => formatWeekdayDate(d, LONDON, { year: false }),
  },
  {
    site: "event pass medium date time",
    old: date(LONDON, { dateStyle: "medium", timeStyle: "short" }),
    next: (d) => formatDateTime(d, LONDON, SEPT),
  },
  {
    site: "event rsvp date time",
    old: date(LONDON, { weekday: "long", ...LONG, hour: "numeric", minute: "2-digit" }),
    next: (d) => formatWeekdayDateTime(d, LONDON),
  },
  {
    site: "shop-api UK day key",
    old: (d) => KEY(LONDON).format(d),
    next: (d) => dayKey(d, LONDON),
  },
  {
    site: "shop-api set print apart time",
    old: date(LONDON, { hour: "2-digit", minute: "2-digit", timeZoneName: "short", hour12: false }),
    next: (d) => formatTimeWithZone(d, LONDON),
  },
  {
    site: "shop-api invoice day",
    old: date(LONDON, SHORT),
    next: (d) => formatDate(d, LONDON, { month: "short", ...SEPT }),
  },
  {
    site: "shop-api long dates",
    old: date(LONDON, LONG),
    next: (d) => formatDate(d, LONDON, { month: "long" }),
  },
  {
    site: "shop alert list (runtime zone)",
    old: date(undefined, SHORT),
    next: (d) => formatDate(d, runtime(), { month: "short", ...SEPT }),
  },
  {
    site: "shop reserved-until time",
    old: date(LONDON, { hour: "2-digit", minute: "2-digit" }),
    next: (d) => formatTime(d, LONDON),
  },
  {
    site: "shop release date",
    old: date(LONDON, SHORT),
    next: (d) => formatDate(d, LONDON, { month: "short", ...SEPT }),
  },
  {
    site: "shop checkout london today",
    old: checkoutToday,
    next: (d) => new Date(`${dayKey(d, LONDON)}T00:00:00Z`).toISOString(),
  },
  {
    site: "shop checkout delivery day (UTC)",
    old: (d) =>
      date("UTC", { weekday: "short", day: "numeric", month: "short" })(d).replace(",", ""),
    next: (d) => formatWeekdayDayMonth(d, "UTC", SEPT).replace(",", ""),
  },
  {
    site: "shop delivery estimate day month (UTC)",
    old: date("UTC", { day: "numeric", month: "short" }),
    next: (d) => formatDayMonthOnly(d, "UTC", SEPT),
  },
  {
    site: "shop delivery estimate weekday (UTC)",
    old: date("UTC", { day: "numeric", month: "short", weekday: "short" }),
    next: (d) => formatWeekdayDayMonth(d, "UTC", SEPT),
  },
  {
    site: "worker sale snapshot day",
    old: saleSnapshotDay,
    next: (d) => formatWeekdayDayMonth(d, LONDON, SEPT),
  },
  { site: "worker crm day key", old: (d) => KEY(LONDON).format(d), next: (d) => dayKey(d, LONDON) },
  {
    site: "worker zoho listing day",
    old: date(LONDON, SHORT),
    next: (d) => formatDate(d, LONDON, { month: "short", ...SEPT }),
  },
  {
    site: "worker zoho listing day time",
    old: date(LONDON, { ...SHORT_TIME, hourCycle: "h23" }),
    next: (d) => formatDateTime(d, LONDON, SEPT),
  },
  {
    site: "worker payout statement (runtime zone)",
    old: (d) => d.toLocaleDateString("en-GB", SHORT),
    next: (d) => formatDate(d, runtime(), { month: "short", ...SEPT }),
  },
  {
    site: "worker impersonation window (UTC)",
    old: date("UTC", { dateStyle: "medium", timeStyle: "short" }),
    next: (d) => formatDateTime(d, "UTC", SEPT),
  },
  {
    site: "worker subject export",
    old: (d) =>
      `${I(LONDON, { dateStyle: "long" }).format(d)} at ${I(LONDON, { timeStyle: "short" }).format(d)}`,
    next: (d) => `${formatDate(d, LONDON, { month: "long" })} at ${formatTime(d, LONDON)}`,
  },
];

describe("stage C call sites keep every character", () => {
  it("records every site on every fixed instant", async () => {
    const lines = SITES.flatMap(({ site, old }) =>
      STAGE_C_INSTANTS.map((d) => `${site} | ${d.toISOString()} | ${old(d)}`),
    );
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./testing/stage-c-sweep.golden.txt");
  });

  it("sees the sites the snapshot is made of", () => {
    expect(SITES.length).toBeGreaterThan(30);
    expect(SITES.length * STAGE_C_INSTANTS.length).toBeGreaterThan(600);
  });

  for (const { site, old, next } of SITES) {
    it(`${site}`, () => {
      for (const d of STAGE_C_INSTANTS) expect(next(d), d.toISOString()).toBe(old(d));
    });
  }
});
