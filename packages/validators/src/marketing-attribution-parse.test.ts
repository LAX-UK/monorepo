import type { MarketingAttributionSnapshot, MarketingAttributionTouch } from "@auction/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { marketingAttributionSnapshotSchema } from "./marketing-attribution-schema.js";
import { parseMarketingAttributionSnapshot } from "./marketing-attribution.js";

/**
 * `parseMarketingAttributionSnapshot` no longer uses Zod. These tests hold it to the Zod
 * implementation it replaced: same accept/reject answer and the same output, key order included.
 */
const OPTIONAL_KEYS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmId",
  "utmTerm",
  "utmContent",
  "utmSourcePlatform",
  "utmCreativeFormat",
  "utmMarketingTactic",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
] as const;

type ParsedTouch = z.infer<typeof marketingAttributionSnapshotSchema>["firstTouch"] & {};

function normalizeTouch(touch: ParsedTouch): MarketingAttributionTouch {
  const out: MarketingAttributionTouch = {
    capturedAt: touch.capturedAt,
    landingPath: touch.landingPath,
  };
  for (const key of OPTIONAL_KEYS) {
    const value = touch[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** The previous implementation, verbatim apart from its name. */
function previousParse(value: unknown): MarketingAttributionSnapshot | null {
  const parsed = marketingAttributionSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  const out: MarketingAttributionSnapshot = { version: data.version };
  if (data.firstTouch !== undefined) out.firstTouch = normalizeTouch(data.firstTouch);
  if (data.lastTouch !== undefined) out.lastTouch = normalizeTouch(data.lastTouch);
  return out;
}

function expectSameAnswer(value: unknown) {
  const expected = previousParse(value);
  const actual = parseMarketingAttributionSnapshot(value);
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
  expect(actual).toStrictEqual(expected);
}

const touch = (extra: Record<string, unknown> = {}) => ({
  capturedAt: "2026-03-01T10:00:00.000Z",
  landingPath: "/sales",
  ...extra,
});

/** Small deterministic generator, so a failure can be replayed. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("parseMarketingAttributionSnapshot matches the Zod schema it replaced", () => {
  const cases: [string, unknown][] = [
    ["first touch only", { version: 1, firstTouch: touch() }],
    ["last touch only", { version: 1, lastTouch: touch() }],
    ["both touches", { version: 1, firstTouch: touch(), lastTouch: touch({ utmSource: "x" }) }],
    ["no touch", { version: 1 }],
    ["touches undefined", { version: 1, firstTouch: undefined, lastTouch: undefined }],
    ["one touch undefined", { version: 1, firstTouch: undefined, lastTouch: touch() }],
    ["touch null", { version: 1, firstTouch: null, lastTouch: touch() }],
    ["version 2", { version: 2, firstTouch: touch() }],
    ["version as text", { version: "1", firstTouch: touch() }],
    ["no version", { firstTouch: touch() }],
    ["unknown keys dropped", { version: 1, x: 1, firstTouch: touch({ y: 2, utmTerm: "t" }) }],
    [
      "every optional field, in shuffled order, trimmed",
      {
        version: 1,
        lastTouch: Object.fromEntries(
          [...OPTIONAL_KEYS]
            .reverse()
            .map((key) => [key, `  ${key}  `])
            .concat([
              ["landingPath", "  /lot/a  "],
              ["capturedAt", "2026-03-01T10:00:00+01:00"],
            ]),
        ),
      },
    ],
    ["field only spaces", { version: 1, firstTouch: touch({ utmSource: "   " }) }],
    ["field empty", { version: 1, firstTouch: touch({ gclid: "" }) }],
    ["field 256 long", { version: 1, firstTouch: touch({ gclid: "a".repeat(256) }) }],
    ["field 257 long", { version: 1, firstTouch: touch({ gclid: "a".repeat(257) }) }],
    ["field 256 after trim", { version: 1, firstTouch: touch({ gclid: ` ${"a".repeat(256)} ` }) }],
    ["field a number", { version: 1, firstTouch: touch({ utmId: 5 }) }],
    ["field null", { version: 1, firstTouch: touch({ utmId: null }) }],
    ["field undefined", { version: 1, firstTouch: touch({ utmId: undefined }) }],
    ["landing path 2048", { version: 1, firstTouch: touch({ landingPath: "/".repeat(2048) }) }],
    ["landing path 2049", { version: 1, firstTouch: touch({ landingPath: "/".repeat(2049) }) }],
    ["landing path blank", { version: 1, firstTouch: touch({ landingPath: " \n\t " }) }],
    ["landing path missing", { version: 1, firstTouch: { capturedAt: "2026-03-01T10:00Z" } }],
    ["captured at missing", { version: 1, firstTouch: { landingPath: "/" } }],
    ["captured at padded", { version: 1, firstTouch: touch({ capturedAt: " 2026-03-01T10:00Z" }) }],
    ["captured at a Date", { version: 1, firstTouch: touch({ capturedAt: new Date(0) }) }],
    [
      "one good touch, one bad",
      { version: 1, firstTouch: touch(), lastTouch: touch({ gclid: 1 }) },
    ],
    ["touch an array", { version: 1, firstTouch: [touch()] }],
    ["touch a Map", { version: 1, firstTouch: new Map(Object.entries(touch())) }],
    ["touch a Date", { version: 1, firstTouch: new Date() }],
    ["snapshot a Map", new Map([["version", 1]])],
    ["touch a Map with the fields", { version: 1, firstTouch: Object.assign(new Map(), touch()) }],
    [
      "snapshot a Map with the fields",
      Object.assign(new Map(), { version: 1, lastTouch: touch() }),
    ],
    [
      "snapshot a Set with the fields",
      Object.assign(new Set(), { version: 1, lastTouch: touch() }),
    ],
    [
      "snapshot a Date with the fields",
      Object.assign(new Date(), { version: 1, lastTouch: touch() }),
    ],
    ["snapshot a Set", new Set([1])],
    ["snapshot a Date", new Date()],
    // biome-ignore lint/suspicious/noThenProperty: Zod reads an object with then and catch as a promise
    ["snapshot thenable", { version: 1, firstTouch: touch(), then: () => {}, catch: () => {} }],
    // biome-ignore lint/suspicious/noThenProperty: and an object with only then as an object
    ["snapshot then only", { version: 1, firstTouch: touch(), then: () => {} }],
    ["snapshot an array", [1]],
    ["null", null],
    ["undefined", undefined],
    ["text", "x"],
    ["number", 1],
  ];

  it.each(cases)("%s", (_label, value) => expectSameAnswer(value));

  const datetimes = [
    "2026-03-01T10:00:00.000Z",
    "2026-03-01T10:00:00Z",
    "2026-03-01T10:00Z",
    "2026-03-01T10Z",
    "2026-03-01T23:59:59.123456789Z",
    "2026-03-01T24:00:00Z",
    "2026-03-01T10:60:00Z",
    "2026-03-01T10:00:60Z",
    "2026-03-01T10:00:00.Z",
    "2026-03-01T10:00:00",
    "2026-03-01 10:00:00Z",
    "2026-03-01t10:00:00z",
    "2026-03-01T10:00:00+01:00",
    "2026-03-01T10:00:00-0130",
    "2026-03-01T10:00:00+1",
    "2026-03-01T10:00:00+01:0",
    "2026-03-01T10:00:00+99:99",
    "2026-03-01T10:00:00Z+01:00",
    "2024-02-29T00:00Z",
    "2023-02-29T00:00Z",
    "2000-02-29T00:00Z",
    "1900-02-29T00:00Z",
    "2026-02-28T00:00Z",
    "2026-04-31T00:00Z",
    "2026-04-30T00:00Z",
    "2026-12-31T00:00Z",
    "2026-13-01T00:00Z",
    "2026-00-10T00:00Z",
    "2026-01-00T00:00Z",
    "10000-01-01T00:00Z",
    "026-01-01T00:00Z",
    "",
  ];

  it.each(datetimes)("captured at %j", (capturedAt) => {
    expectSameAnswer({ version: 1, firstTouch: touch({ capturedAt }) });
  });

  it("agrees on random date-times", () => {
    const next = rng(20261113);
    const pick = (chars: string) => chars[Math.floor(next() * chars.length)];
    const digits = "0123456789";
    for (let i = 0; i < 5000; i++) {
      let value = "";
      const shape = "dddd-dd-ddTdd:dd:dd.ddd+dd:dd";
      for (const ch of shape) {
        const roll = next();
        if (roll < 0.03) continue; // drop a character
        if (roll < 0.06) value += pick("-:T.Z+ x9"); // a stray character
        value += ch === "d" ? pick(digits) : ch;
      }
      if (next() < 0.3) value = value.replace(/\+.*$/, "Z");
      expectSameAnswer({ version: 1, lastTouch: touch({ capturedAt: value }) });
    }
  });

  it("agrees on random touches", () => {
    const next = rng(42);
    const values: unknown[] = [
      undefined,
      null,
      "",
      " ",
      "x",
      " y ",
      "a".repeat(256),
      "b".repeat(257),
      0,
      true,
      [],
      {},
      " z ",
      "﻿w",
    ];
    for (let i = 0; i < 3000; i++) {
      const t: Record<string, unknown> = { capturedAt: "2026-03-01T10:00:00Z", landingPath: "/" };
      for (const key of [...OPTIONAL_KEYS, "landingPath", "extra"]) {
        if (next() < 0.25) t[key] = values[Math.floor(next() * values.length)];
      }
      const which = next();
      const snapshot =
        which < 0.4
          ? { version: 1, firstTouch: t }
          : which < 0.8
            ? { version: 1, lastTouch: t }
            : { version: 1, firstTouch: t, lastTouch: t };
      expectSameAnswer(snapshot);
    }
  });

  it("uses the same date-time pattern as Zod", () => {
    const zodCheck = z.string().datetime({ offset: true });
    const accepted = (value: string) =>
      parseMarketingAttributionSnapshot({
        version: 1,
        firstTouch: touch({ capturedAt: value }),
      }) !== null;
    for (const value of datetimes) {
      expect(accepted(value)).toBe(zodCheck.safeParse(value).success);
    }
  });
});
