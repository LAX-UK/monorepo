import { describe, expect, it, vi } from "vitest";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import { anonymiseBidPersonalData } from "./anonymise-bid-personal-data.js";
import { BID_ANONYMISATION_RULES, type BidAnonymisationRule } from "./bid-personal-data-policy.js";

/** A select chain that answers the two scope lookups in order: aliases, then personal entities. */
function scopeTx(aliases: string[], entities: string[]) {
  const answers = [aliases.map((id) => ({ id })), entities.map((id) => ({ id }))];
  const select = vi.fn(() => ({
    from: () => ({ where: () => Promise.resolve(answers.shift() ?? []) }),
  }));
  return { select } as unknown as ProjectorDbConnection;
}

function rule(table: string, apply: BidAnonymisationRule["apply"]): BidAnonymisationRule {
  return { table, treatment: "scrub", fields: [], apply };
}

describe("anonymiseBidPersonalData", () => {
  it("applies every rule to one scope that includes merged aliases and personal accounts", async () => {
    const seen: unknown[] = [];
    const rules = [
      rule("a", async (_tx, scope) => {
        seen.push(scope);
        return 2;
      }),
    ];
    await anonymiseBidPersonalData(scopeTx(["old_1"], ["entity_1"]), "user_1", rules);
    expect(seen).toEqual([
      {
        subjectIds: ["user_1", "old_1"],
        personalLegalEntityIds: ["entity_1"],
        pseudonym: expect.stringMatching(/^Deleted user [0-9A-F]{4}$/),
      },
    ]);
  });

  it("reports only the tables that changed", async () => {
    const rules = [rule("changed", async () => 3), rule("untouched", async () => 0)];
    const counts = await anonymiseBidPersonalData(scopeTx([], []), "user_1", rules);
    expect(counts).toEqual({ changed: 3 });
  });

  it("gives the same pseudonym on every run for the same person", async () => {
    const pseudonyms: string[] = [];
    const rules = [
      rule("a", async (_tx, scope) => {
        pseudonyms.push(scope.pseudonym);
        return 0;
      }),
    ];
    await anonymiseBidPersonalData(scopeTx([], []), "user_1", rules);
    await anonymiseBidPersonalData(scopeTx([], []), "user_1", rules);
    expect(pseudonyms[0]).toBe(pseudonyms[1]);
  });
});

describe("Bid anonymisation policy", () => {
  it("names each table once", () => {
    const tables = BID_ANONYMISATION_RULES.map((r) => r.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("lists the fields of every scrub and none for a delete", () => {
    for (const r of BID_ANONYMISATION_RULES) {
      if (r.treatment === "scrub") expect(r.fields.length).toBeGreaterThan(0);
      else expect(r.fields).toEqual([]);
    }
  });

  it("never touches the records kept for legal and accounting reasons", () => {
    const kept = [
      "bid",
      "absentee_bid",
      "payment",
      "payout",
      "payout_line",
      "kyc_verification",
      "sale_registration",
      "source_of_funds",
    ];
    const tables = BID_ANONYMISATION_RULES.map((r) => r.table);
    for (const table of kept) expect(tables).not.toContain(table);
  });

  it("covers the profile, personal account, address book and phone data", () => {
    const tables = BID_ANONYMISATION_RULES.map((r) => r.table);
    expect(tables).toEqual(
      expect.arrayContaining([
        "bid_user_profile",
        "legal_entity",
        "legal_entity_contact_details",
        "legal_entity_address",
        "user_address",
        "telephone_bid_booking",
      ]),
    );
  });
});
