import { describe, expect, it } from "vitest";
import {
  TIME_LEFT_DATE_BEYOND_MS,
  formatTimeLeft,
  timeLeftShowsSeconds,
  timeLeftView,
} from "../lot-page/time-left.js";
import { COUNTDOWN_SURFACES, type CountdownSurface, countdownDisplay } from "./countdown-policy.js";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

/** The wording as it was before the lot page rows changed, which every other surface still uses. */
const legacy = {
  words: (ms: number) => formatTimeLeft(ms, { showSeconds: timeLeftShowsSeconds(ms) }),
  short(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  },
  compact(ms: number) {
    if (ms >= H) return legacy.short(ms);
    const total = Math.max(0, Math.floor(ms / 1000));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  },
  tiles(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days > 0)
      return [
        { unit: "Days", value: days },
        { unit: "Hours", value: hours },
      ];
    if (hours > 0)
      return [
        { unit: "Hours", value: hours },
        { unit: "Min", value: minutes },
      ];
    return [
      { unit: "Min", value: minutes },
      { unit: "Sec", value: seconds },
    ];
  },
};

/** The same instant rounded up to the whole second, which is how every surface reads it now. */
const roundedUp = (ms: number) => Math.ceil(ms / S) * S;

/** Every second to three hours (with part seconds), a stride across the rest of the week, the edges. */
function sweep(): number[] {
  const values = new Set<number>();
  for (let s = 1; s <= 3 * 3600; s += 1)
    values.add(s * S + (s % 3 === 0 ? 999 : s % 3 === 1 ? 0 : 500));
  for (let s = 3 * 3600; s <= 7 * 86_400; s += 37)
    for (const part of [0, 999]) values.add(s * S + part);
  for (const edge of [7 * D, 7 * D - 1, D, D - 1, H, H - 1, 2 * M, 2 * M - 1, M, M - 1, 1])
    values.add(edge);
  return [...values];
}
const SWEEP = sweep();

function counting(surface: CountdownSurface, ms: number, ctx = {}) {
  const d = countdownDisplay(surface, ms, ctx);
  if (d.kind !== "counting") throw new Error(`${surface} ${ms} is ${d.kind}`);
  return d;
}

describe("the surfaces other than the lot page read as before, from the rounded-up second", () => {
  const inRange = SWEEP.filter((ms) => roundedUp(ms) <= TIME_LEFT_DATE_BEYOND_MS);

  it("card: words by the time rule", () => {
    for (const ms of inRange)
      expect(counting("card", ms).text, String(ms)).toBe(legacy.words(roundedUp(ms)));
  });

  it("chip: the compact form", () => {
    for (const ms of inRange)
      expect(counting("chip", ms).text, String(ms)).toBe(legacy.compact(roundedUp(ms)));
  });

  it("saleHero: the two largest tiles", () => {
    for (const ms of inRange)
      expect(counting("saleHero", ms).tiles, String(ms)).toEqual(legacy.tiles(roundedUp(ms)));
  });

  it("cover: the clock in the final hour, the caller's own text before it", () => {
    for (const ms of SWEEP.filter((v) => roundedUp(v) < H)) {
      expect(counting("cover", ms).text, String(ms)).toBe(legacy.compact(roundedUp(ms)));
    }
    expect(countdownDisplay("cover", H).kind).toBe("static");
    expect(countdownDisplay("cover", 3 * D).kind).toBe("static");
    expect(countdownDisplay("cover", H - 1000).kind).toBe("counting");
  });

  it("every surface agrees on the tone and label of the same second", () => {
    for (const ms of inRange) {
      const view = timeLeftView(ms);
      for (const surface of ["lot", "lotBar", "card", "chip", "saleHero"] as CountdownSurface[]) {
        const d = counting(surface, ms);
        expect(d.tone, `${surface} ${ms}`).toBe(view.tone);
        expect(d.label, `${surface} ${ms}`).toBe(view.label);
      }
    }
  });
});

describe("the lot page rows count seconds for the whole week", () => {
  it.each<[string, number, string]>([
    ["7 days exactly", 7 * D, "7d 00h 00m 00s"],
    ["2 days 4 h 12 min 32.4 s", 2 * D + 4 * H + 12 * M + 32_400, "2d 04h 12m 33s"],
    ["24 hours", D, "1d 00h 00m 00s"],
    ["24 hours less a second", D - S, "23h 59m 59s"],
    ["1 hour", H, "1h 00m 00s"],
    ["1 hour less a second", H - S, "59m 59s"],
    ["42 min 9 s", 42 * M + 9 * S, "42m 09s"],
    ["1 minute", M, "1m 00s"],
    ["48 s", 48 * S, "48s"],
    ["999 ms", 999, "1s"],
  ])("%s reads %s", (_name, ms, text) => {
    expect(counting("lot", ms).text).toBe(text);
    expect(counting("lotBar", ms).text).toBe(text);
  });

  it("tone and text read the same rounded second: at 59:59.4 it is 1h 00m 00s and still calm", () => {
    const d = counting("lot", H - 600);
    expect(d.text).toBe("1h 00m 00s");
    expect(d.tone).toBe("calm");
    const next = counting("lot", H - 1000);
    expect(next.text).toBe("59m 59s");
    expect(next.tone).toBe("soon");
  });

  it("bands: calm over an hour, soon under, final from two minutes", () => {
    expect(counting("lot", D).label).toBe("Time left");
    expect(counting("lot", 42 * M).label).toBe("Closing soon");
    expect(counting("lot", 2 * M - S).label).toBe("Final minutes");
    expect(counting("lot", 2 * M - S).tone).toBe("final");
  });

  it("an extended lot is final and says Extended at any time", () => {
    const d = counting("lot", 3 * D, { extended: true });
    expect(d.tone).toBe("final");
    expect(d.label).toBe("Extended");
  });

  it("reduced motion changes once a minute above the final hour and counts seconds in it", () => {
    expect(counting("lot", 3 * H + 5 * M + 20 * S, { reducedMotion: true }).text).toBe("3h 05m");
    expect(counting("lot", 2 * D + 4 * H + 12 * M + 32_400, { reducedMotion: true }).text).toBe(
      "2d 04h 12m",
    );
    expect(counting("lot", 30 * M + 20 * S, { reducedMotion: true }).text).toBe("30m 20s");
    const above = counting("lot", 3 * H + 30 * S, { reducedMotion: true });
    expect(above.nextChangeInMs).toBeGreaterThan(30 * S);
    expect(above.nextChangeInMs).toBeLessThanOrEqual(M);
    expect(counting("lot", 30 * M, { reducedMotion: true }).nextChangeInMs).toBeLessThanOrEqual(S);
  });
});

describe("countdownDisplay edges", () => {
  it("more than 7 days is a date on every surface that counts", () => {
    for (const surface of ["lot", "lotBar", "card", "chip", "saleHero"] as CountdownSurface[]) {
      expect(countdownDisplay(surface, 7 * D + 1).kind, surface).toBe("date");
      expect(countdownDisplay(surface, 7 * D).kind, surface).toBe("counting");
    }
  });

  it("zero and below is closing; not a number is none", () => {
    expect(countdownDisplay("card", 0)).toEqual({ kind: "closing" });
    expect(countdownDisplay("lot", -5 * S)).toEqual({ kind: "closing" });
    expect(countdownDisplay("card", Number.NaN)).toEqual({ kind: "none" });
    expect(countdownDisplay("card", Number.POSITIVE_INFINITY)).toEqual({ kind: "none" });
  });

  it("spoken text is to the minute at every edge", () => {
    const spoken = (ms: number) => counting("card", ms).spoken;
    expect(spoken(D)).toBe("1 day");
    expect(spoken(H)).toBe("1 hour");
    expect(spoken(H - S)).toBe("59 minutes");
    expect(spoken(M)).toBe("1 minute");
    expect(spoken(45 * S)).toBe("0 minutes");
  });
});

describe("countdownDisplay nextChangeInMs", () => {
  const next = (surface: CountdownSurface, ms: number, ctx = {}) => {
    const d = countdownDisplay(surface, ms, ctx);
    return "nextChangeInMs" in d ? d.nextChangeInMs : null;
  };

  const strip = (d: ReturnType<typeof countdownDisplay>) => {
    if (d.kind !== "counting") return { kind: d.kind };
    const { nextChangeInMs: _ignored, ...rest } = d;
    return rest;
  };

  /** The text really is unchanged until then, and different right after. */
  it("is exactly when the text changes, across the bands, for every surface", () => {
    const times = [
      6 * D + 5 * H + 1234,
      30 * H + 777,
      5 * H + 12 * M + 10,
      H + 5,
      H,
      H - 1,
      42 * M + 500,
      2 * M + 3,
      2 * M,
      90 * S + 20,
      5 * S + 1,
      S,
    ];
    for (const ctx of [{}, { reducedMotion: true }]) {
      for (const surface of ["card", "chip", "saleHero", "lot", "lotBar"] as CountdownSurface[]) {
        for (const ms of times) {
          const before = countdownDisplay(surface, ms, ctx);
          const wait = next(surface, ms, ctx);
          expect(wait, `${surface} ${ms}`).not.toBeNull();
          const still = countdownDisplay(surface, ms - (wait as number) + 1, ctx);
          const changed = countdownDisplay(surface, ms - (wait as number), ctx);
          expect(JSON.stringify(strip(still)), `${surface} ${ms} still`).toBe(
            JSON.stringify(strip(before)),
          );
          expect(JSON.stringify(strip(changed)), `${surface} ${ms} changes`).not.toBe(
            JSON.stringify(strip(before)),
          );
        }
      }
    }
  });

  it("wakes every second on the lot page all week, and once a minute on a card above the final hour", () => {
    expect(next("lot", 3 * D + 5 * H)).toBeLessThanOrEqual(S);
    expect(next("card", 5 * H + 12 * M + 10)).toBeGreaterThan(1);
    expect(next("card", 5 * H + 12 * M + 10)).toBeLessThanOrEqual(M);
    expect(next("card", 42 * M + 500)).toBeLessThanOrEqual(S);
  });

  it("a date waits for the count to start; a static cover waits for the final hour", () => {
    expect(next("card", 7 * D + 5 * S)).toBe(5 * S);
    expect(next("cover", H + 3 * S)).toBe(4 * S);
  });
});

describe("the surface table", () => {
  it("has a row for every surface, and the date threshold is the shared seven days", () => {
    expect(Object.keys(COUNTDOWN_SURFACES).sort()).toEqual(
      ["card", "chip", "cover", "lot", "lotBar", "saleHero"].sort(),
    );
    expect(COUNTDOWN_SURFACES.card.dateBeyondMs).toBe(TIME_LEFT_DATE_BEYOND_MS);
    expect(COUNTDOWN_SURFACES.lot.secondsBelowMs).toBeGreaterThan(TIME_LEFT_DATE_BEYOND_MS);
  });
});
