import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SEARCH_GROUPS,
  type AccountSearchScopes,
  accountSearchGroupsFor,
  accountSearchScopes,
  accountSearchTerms,
} from "./account-record-search.js";

/**
 * Every role against every record type. Each cell is the scope the list behind the group uses
 * for that role; a missing group means the role cannot open that list and finds nothing there.
 */
const MATRIX: Record<LegalEntityMemberRole, AccountSearchScopes> = {
  owner: {
    consignments: "all",
    purchases: "all",
    bids: "all",
    invoices: "all",
    members: "all",
  },
  admin: {
    consignments: "all",
    purchases: "all",
    bids: "all",
    invoices: "all",
    members: "all",
  },
  finance: { consignments: "attributed", purchases: "all", invoices: "all" },
  consignor: { consignments: "own" },
  buyer_agent: { purchases: "own", bids: "own", works: "all" },
  viewer: { consignments: "attributed", works: "all" },
};

describe("account search: capability matrix", () => {
  it("covers every role", () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...legalEntityMemberRoles].sort());
  });

  for (const role of legalEntityMemberRoles) {
    for (const group of ACCOUNT_SEARCH_GROUPS) {
      const expected = MATRIX[role][group] ?? null;
      it(`${role} × ${group}: ${expected ?? "not searched"}`, () => {
        expect(accountSearchScopes({ role })[group] ?? null).toBe(expected);
      });
    }
  }

  it("lists the searchable groups in display order", () => {
    expect(accountSearchGroupsFor({ role: "buyer_agent" })).toEqual(["purchases", "bids", "works"]);
    expect(accountSearchGroupsFor({ role: "consignor" })).toEqual(["consignments"]);
  });

  it("lets an impersonating admin search what the role reads (search never writes)", () => {
    expect(accountSearchScopes({ role: "admin", isImpersonation: true })).toEqual(MATRIX.admin);
  });

  it("finds a won work once: under Purchases for members who follow every purchase", () => {
    for (const role of legalEntityMemberRoles) {
      const scopes = accountSearchScopes({ role });
      expect(scopes.purchases === "all" && scopes.works !== undefined).toBe(false);
    }
  });
});

describe("accountSearchTerms", () => {
  it("trims and collapses whitespace", () => {
    expect(accountSearchTerms("  David   Hockney ")).toEqual({
      text: "David Hockney",
      lotNumber: null,
    });
  });

  it("refuses text too short to search", () => {
    expect(accountSearchTerms("")).toBeNull();
    expect(accountSearchTerms("  a ")).toBeNull();
  });

  it("reads a lot reference, even a single digit", () => {
    expect(accountSearchTerms("7")).toEqual({ text: "7", lotNumber: 7 });
    expect(accountSearchTerms("Lot 12")).toEqual({ text: "Lot 12", lotNumber: 12 });
    expect(accountSearchTerms("lot12")).toEqual({ text: "lot12", lotNumber: 12 });
    expect(accountSearchTerms("#305")).toEqual({ text: "#305", lotNumber: 305 });
  });

  it("does not treat an invoice number as a lot reference", () => {
    expect(accountSearchTerms("INV-0012")).toEqual({ text: "INV-0012", lotNumber: null });
  });

  it("caps very long input", () => {
    expect(accountSearchTerms("x".repeat(500))?.text).toHaveLength(100);
  });
});
