import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { anonymiseShopPersonalData } from "./anonymise-shop-personal-data.js";
import {
  SHOP_ANONYMISATION_RULES,
  type ShopAnonymisationRule,
} from "./shop-personal-data-policy.js";

const now = new Date("2026-11-02T10:00:00.000Z");

function aliasTx(aliases: string[]) {
  return {
    select: vi.fn(() => ({
      from: () => ({ where: () => Promise.resolve(aliases.map((id) => ({ id }))) }),
    })),
  } as unknown as Database;
}

function rule(table: string, apply: ShopAnonymisationRule["apply"]): ShopAnonymisationRule {
  return { table, treatment: "scrub", fields: [], apply };
}

describe("anonymiseShopPersonalData", () => {
  it("works on the subject and every alias merged into it, with one pseudonym and one clock", async () => {
    const scopes: unknown[] = [];
    await anonymiseShopPersonalData(aliasTx(["old_1"]), "user_1", now, [
      rule("a", async (_tx, scope) => {
        scopes.push(scope);
        return 1;
      }),
    ]);
    expect(scopes).toEqual([
      {
        subjectId: "user_1",
        subjectIds: ["user_1", "old_1"],
        pseudonym: expect.stringMatching(/^Deleted user [0-9A-F]{4}$/),
        now,
      },
    ]);
  });

  it("reports only the tables that changed", async () => {
    const counts = await anonymiseShopPersonalData(aliasTx([]), "user_1", now, [
      rule("changed", async () => 2),
      rule("untouched", async () => 0),
    ]);
    expect(counts).toEqual({ changed: 2 });
  });
});

describe("Shop anonymisation policy", () => {
  const tables = SHOP_ANONYMISATION_RULES.map((r) => r.table);

  it("names each table once", () => {
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("lists the fields of every scrub and none for a delete", () => {
    for (const r of SHOP_ANONYMISATION_RULES) {
      if (r.treatment === "scrub") expect(r.fields.length).toBeGreaterThan(0);
      else expect(r.fields).toEqual([]);
    }
  });

  it("covers profile, party, orders, enquiries, saved works and followed artists", () => {
    expect(tables).toEqual(
      expect.arrayContaining([
        "shop_user_profile",
        "shop_party",
        "shop_order",
        "shop_artwork_interest",
        "shop_general_enquiry",
        "shop_saved_artwork",
        "shop_followed_artist",
      ]),
    );
  });

  it("keeps the financial records", () => {
    for (const kept of ["shop_order_line", "shop_refund", "shop_payout_ledger", "shop_sale_fee"]) {
      expect(tables).not.toContain(kept);
    }
  });
});
