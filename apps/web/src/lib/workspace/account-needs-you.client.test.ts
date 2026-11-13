import { parseAccountNeedsYouBody } from "@/lib/workspace/account-needs-you.client";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/** The schema this parser replaced; the parser must give the same answer for every body. */
const previousSchema = z.object({
  data: z.object({
    accounts: z.array(
      z.object({ legalEntityId: z.string(), count: z.number().int().nonnegative() }),
    ),
  }),
});

function previousParse(body: unknown) {
  const parsed = previousSchema.safeParse(body);
  if (!parsed.success) return null;
  return Object.fromEntries(parsed.data.data.accounts.map((a) => [a.legalEntityId, a.count]));
}

const account = (legalEntityId: unknown, count: unknown) => ({ legalEntityId, count });

const bodies: [string, unknown][] = [
  ["two accounts", { data: { accounts: [account("le-1", 3), account("le-2", 0)] } }],
  ["no accounts", { data: { accounts: [] } }],
  ["extra fields everywhere", { ok: 1, data: { x: 1, accounts: [{ ...account("a", 1), y: 2 }] } }],
  ["a repeated id (last wins)", { data: { accounts: [account("a", 1), account("a", 2)] } }],
  ["negative zero", { data: { accounts: [account("a", -0)] } }],
  ["a large count", { data: { accounts: [account("a", 2 ** 40)] } }],
  ["a negative count", { data: { accounts: [account("a", -1)] } }],
  ["a fractional count", { data: { accounts: [account("a", 1.5)] } }],
  ["a count as text", { data: { accounts: [account("a", "1")] } }],
  ["NaN", { data: { accounts: [account("a", Number.NaN)] } }],
  ["Infinity", { data: { accounts: [account("a", Number.POSITIVE_INFINITY)] } }],
  ["a missing count", { data: { accounts: [{ legalEntityId: "a" }] } }],
  ["a numeric id", { data: { accounts: [account(1, 1)] } }],
  ["a null id", { data: { accounts: [account(null, 1)] } }],
  ["one bad row among good ones", { data: { accounts: [account("a", 1), account("b", -2)] } }],
  ["a null row", { data: { accounts: [null] } }],
  ["an array row", { data: { accounts: [["a", 1]] } }],
  ["accounts as an object", { data: { accounts: { a: account("a", 1) } } }],
  ["accounts missing", { data: {} }],
  ["data as an array", { data: [] }],
  ["data null", { data: null }],
  ["body null", null],
  ["body an array", []],
  ["body text", "nope"],
  ["body a number", 42],
  ["body undefined", undefined],
];

describe("parseAccountNeedsYouBody", () => {
  it.each(bodies)("matches the previous schema for %s", (_label, body) => {
    const expected = previousParse(body);
    const actual = parseAccountNeedsYouBody(body);
    expect(actual).toStrictEqual(expected);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    if (expected) expect(Object.is(actual?.a, expected.a)).toBe(true);
  });

  it("reads the counts by organisation id", () => {
    expect(
      parseAccountNeedsYouBody({ data: { accounts: [account("le-1", 3), account("le-2", 0)] } }),
    ).toStrictEqual({ "le-1": 3, "le-2": 0 });
  });

  it("refuses a body with one bad row", () => {
    expect(
      parseAccountNeedsYouBody({ data: { accounts: [account("le-1", 3), account("le-2", 0.5)] } }),
    ).toBeNull();
  });
});
