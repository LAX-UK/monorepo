import { describe, expect, it } from "vitest";
import { timeLeftView } from "../lot-page/time-left.js";
import {
  TIME_LEFT_DATE_BEYOND_MS,
  formatTimeLeft,
  timeLeftShowsSeconds,
} from "../lot-page/time-left.js";
import { COUNTDOWN_SURFACES, type CountdownSurface, countdownDisplay } from "./countdown-policy.js";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

/**
 * The formatters as they were before the surfaces moved onto one table, kept here as the
 * reference the table must reproduce.
 */
const legacy = {
  words: (ms: number) => formatTimeLeft(ms, { showSeconds: timeLeftShowsSeconds(ms) }),
  short: (ms: number) => {
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

/** Every second to three hours (with part seconds), then a stride across the rest of the seven days, plus the edges. */
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

describe("countdownDisplay matches today's formatters for every surface", () => {
  it("card: words by the time rule", () => {
    for (const ms of SWEEP) {
      const d = countdownDisplay("card", ms);
      expect(d.kind, String(ms)).toBe("counting");
      if (d.kind === "counting") expect(d.text, String(ms)).toBe(legacy.words(ms));
    }
  });

  it("lot: the lot page's time row text, tone and label", () => {
    for (const ms of SWEEP) {
      const view = timeLeftView(ms);
      const d = countdownDisplay("lot", ms);
      expect(d.kind).toBe("counting");
      if (d.kind === "counting") {
        expect(d.text, String(ms)).toBe(view.text);
        expect(d.tone, String(ms)).toBe(view.tone);
        expect(d.label, String(ms)).toBe(view.label);
      }
    }
  });

  it("lotBar: words and the compact form the phone bar picks between", () => {
    for (const ms of SWEEP) {
      const d = countdownDisplay("lotBar", ms);
      expect(d.kind).toBe("counting");
      if (d.kind === "counting") {
        expect(d.text, String(ms)).toBe(legacy.words(ms));
        expect(d.compact, String(ms)).toBe(legacy.compact(ms));
      }
    }
  });

  it("chip: the compact form", () => {
    for (const ms of SWEEP) {
      const d = countdownDisplay("chip", ms);
      expect(d.kind).toBe("counting");
      if (d.kind === "counting") expect(d.text, String(ms)).toBe(legacy.compact(ms));
    }
  });

  it("saleHero: the two largest tiles", () => {
    for (const ms of SWEEP) {
      const d = countdownDisplay("saleHero", ms);
      expect(d.kind).toBe("counting");
      if (d.kind === "counting") expect(d.tiles, String(ms)).toEqual(legacy.tiles(ms));
    }
  });

  it("cover: the clock in the final hour, the caller's own text before it", () => {
    for (const ms of SWEEP.filter((v) => v < H)) {
      const d = countdownDisplay("cover", ms);
      expect(d.kind).toBe("counting");
      if (d.kind === "counting") expect(d.text, String(ms)).toBe(legacy.compact(ms));
    }
    expect(countdownDisplay("cover", H).kind).toBe("static");
    expect(countdownDisplay("cover", 3 * D).kind).toBe("static");
  });
});

describe("countdownDisplay edges", () => {
  it.each<[string, number, string]>([
    ["7 days", 7 * D, "7 days"],
    ["24 hours", D, "1 day"],
    ["24 hours less a second", D - S, "23 hours 59 minutes"],
    ["1 hour", H, "1 hour"],
    ["1 hour less a second", H - S, "59 minutes 59 seconds"],
    ["1 minute", M, "1 minute"],
    ["999 ms", 999, "0 seconds"],
  ])("lot at %s reads %s", (_name, ms, text) => {
    const d = countdownDisplay("lot", ms);
    expect(d.kind === "counting" && d.text).toBe(text);
  });

  it("more than 7 days is a date on every surface that counts", () => {
    for (const surface of ["lot", "lotBar", "card", "chip", "saleHero"] as CountdownSurface[]) {
      expect(countdownDisplay(surface, 7 * D + 1).kind, surface).toBe("date");
      expect(countdownDisplay(surface, 7 * D).kind, surface).toBe("counting");
    }
  });

  it("zero and below is closing; not a number is none", () => {
    expect(countdownDisplay("card", 0)).toEqual({ kind: "closing" });
    expect(countdownDisplay("card", -5 * S)).toEqual({ kind: "closing" });
    expect(countdownDisplay("card", Number.NaN)).toEqual({ kind: "none" });
    expect(countdownDisplay("card", Number.POSITIVE_INFINITY)).toEqual({ kind: "none" });
  });

  it("tone follows the bands: calm over an hour, soon under, final under two minutes", () => {
    const tone = (ms: number) => {
      const d = countdownDisplay("card", ms);
      return d.kind === "counting" ? d.tone : null;
    };
    expect(tone(H)).toBe("calm");
    expect(tone(H - 1)).toBe("soon");
    expect(tone(2 * M)).toBe("soon");
    expect(tone(2 * M - 1)).toBe("final");
  });

  it("an extended lot is always final", () => {
    const d = countdownDisplay("card", 3 * H, { extended: true });
    expect(d.kind === "counting" && d.tone).toBe("final");
  });

  it("spoken text is to the minute at every edge", () => {
    const spoken = (ms: number) => {
      const d = countdownDisplay("card", ms);
      return d.kind === "counting" ? d.spoken : null;
    };
    expect(spoken(D)).toBe("1 day");
    expect(spoken(H)).toBe("1 hour");
    expect(spoken(H - S)).toBe("59 minutes");
    expect(spoken(M)).toBe("1 minute");
    expect(spoken(45 * S)).toBe("0 minutes");
  });
});

describe("countdownDisplay nextChangeInMs", () => {
  const next = (surface: CountdownSurface, ms: number) => {
    const d = countdownDisplay(surface, ms);
    return "nextChangeInMs" in d ? d.nextChangeInMs : null;
  };

  /** The text really is unchanged until then, and different right after. */
  it("is exactly when the text changes, across the bands", () => {
    for (const surface of ["card", "chip", "saleHero", "lot", "lotBar"] as CountdownSurface[]) {
      for (const ms of [
        6 * D + 5 * H + 1234,
        30 * H + 777,
        5 * H + 12 * M + 10,
        H + 5,
        H - 1,
        42 * M + 500,
        2 * M + 3,
        90 * S + 20,
        5 * S + 1,
      ]) {
        const before = countdownDisplay(surface, ms);
        const wait = next(surface, ms);
        expect(wait, `${surface} ${ms}`).not.toBeNull();
        const at = countdownDisplay(surface, ms - (wait as number) + 1);
        const after = countdownDisplay(surface, ms - (wait as number));
        expect(JSON.stringify(strip(at)), `${surface} ${ms} still`).toBe(
          JSON.stringify(strip(before)),
        );
        expect(JSON.stringify(strip(after)), `${surface} ${ms} changes`).not.toBe(
          JSON.stringify(strip(before)),
        );
      }
    }
  });

  it("wakes once a minute while only minutes show, and once a second in the final hour", () => {
    expect(next("card", 5 * H + 12 * M + 10)).toBeGreaterThan(1);
    expect(next("card", 5 * H + 12 * M + 10)).toBeLessThanOrEqual(M);
    expect(next("card", 42 * M + 500)).toBeLessThanOrEqual(S);
  });

  it("a date waits for the count to start; a static cover waits for the final hour", () => {
    expect(next("card", 7 * D + 5 * S)).toBe(5 * S);
    expect(next("cover", H + 3 * S)).toBe(3 * S + 1);
  });
});

function strip(d: ReturnType<typeof countdownDisplay>) {
  if (d.kind !== "counting") return { kind: d.kind };
  const { nextChangeInMs: _ignored, ...rest } = d;
  return rest;
}

describe("the surface table", () => {
  it("has a row for every surface, and the date threshold is the shared seven days", () => {
    expect(Object.keys(COUNTDOWN_SURFACES).sort()).toEqual(
      ["card", "chip", "cover", "lot", "lotBar", "saleHero"].sort(),
    );
    expect(COUNTDOWN_SURFACES.card.dateBeyondMs).toBe(TIME_LEFT_DATE_BEYOND_MS);
  });
});
