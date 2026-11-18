import type { AdminArtworkConsignorAgreement, AdminConsignorChange } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  checkConsignorForm,
  consignorAgreementLine,
  consignorErrorsFromIssues,
  consignorFilterChip,
  consignorFilterOptions,
  consignorFormValues,
  consignorHistory,
  consignorHref,
  consignorName,
} from "./artwork-consignor.vm";

const PARTY = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-11-17";

const client: AdminConsignorChange = {
  id: "66666666-6666-4666-8666-666666666666",
  consignor: { kind: "client", partyId: PARTY, displayName: "Ivo Marren" },
  changeReason: null,
  setAt: "2026-11-10T10:00:00.000Z",
  setByName: null,
};
const lax: AdminConsignorChange = {
  ...client,
  id: "77777777-7777-4777-8777-777777777777",
  consignor: { kind: "lax" },
  changeReason: "Bought outright",
  setByName: "Sam Staff",
};

function agreement(
  patch: Partial<AdminArtworkConsignorAgreement> = {},
): AdminArtworkConsignorAgreement {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    places: ["lax_bid"],
    startsOn: "2026-03-03",
    endsOn: null,
    status: "current",
    createdAt: "2026-03-03T10:00:00.000Z",
    ...patch,
  };
}

describe("the Consignor field", () => {
  it("names a client or LAX, and links a client's agreements", () => {
    expect(consignorName(client.consignor)).toBe("Ivo Marren");
    expect(consignorName({ kind: "lax" })).toBe("LAX owns this work");
    expect(consignorHref(client.consignor)).toBe(`/clients/${PARTY}#agreements`);
    expect(consignorHref({ kind: "lax" })).toBeNull();
  });

  it("reads the agreement line: not set, LAX, none, or the leading agreement", () => {
    expect(consignorAgreementLine({ current: null, agreements: [] }, TODAY)).toEqual({
      kind: "not_set",
    });
    expect(consignorAgreementLine({ current: lax, agreements: [] }, TODAY)).toEqual({
      kind: "lax",
    });
    expect(consignorAgreementLine({ current: client, agreements: [] }, TODAY)).toEqual({
      kind: "none",
    });
    const line = consignorAgreementLine(
      {
        current: client,
        agreements: [
          agreement({ id: "old", endsOn: "2026-06-30", places: ["private_sale"] }),
          agreement({ id: "now", places: ["lax_bid", "lax_art"] }),
        ],
      },
      TODAY,
    );
    expect(line).toMatchObject({
      kind: "agreement",
      agreement: { id: "now" },
      badge: { label: "In force", tone: "success" },
      places: "LAX Bid and lax.art",
      others: 1,
    });
  });

  it("tells the history as set, then changed, with the reason and who did it", () => {
    const events = consignorHistory({ history: [lax, client] });
    expect(events.map((event) => [event.title, event.actor, event.detail])).toEqual([
      ["Changed to LAX owns this work", "Sam Staff", "Bought outright"],
      ["Set to Ivo Marren", "LAX staff", undefined],
    ]);
  });
});

describe("the Set consignor form", () => {
  it("opens on the consignor now, or with nothing chosen", () => {
    expect(consignorFormValues(null)).toEqual({ kind: null, client: null, reason: "" });
    expect(consignorFormValues(client)).toEqual({
      kind: "client",
      client: { id: PARTY, label: "Ivo Marren" },
      reason: "",
    });
  });

  it("needs a choice, and a client when a client is chosen", () => {
    expect(checkConsignorForm({ kind: null, client: null, reason: "" }, null)).toEqual({
      ok: false,
      errors: { kind: "Choose who consigned this work." },
    });
    expect(checkConsignorForm({ kind: "client", client: null, reason: "" }, null)).toEqual({
      ok: false,
      errors: { client: "Choose a client." },
    });
  });

  it("sets the first consignor without a reason", () => {
    expect(
      checkConsignorForm(
        { kind: "client", client: { id: OTHER, label: "Ana" }, reason: " " },
        null,
      ),
    ).toEqual({
      ok: true,
      body: {
        consignor: { kind: "client", partyId: OTHER },
        reason: null,
        expectedCurrentId: null,
      },
    });
  });

  it("needs a reason for a change, and a different consignor", () => {
    expect(
      checkConsignorForm(
        { kind: "client", client: { id: PARTY, label: "Ivo" }, reason: "" },
        client,
      ),
    ).toEqual({
      ok: false,
      errors: {
        kind: "This is the consignor already.",
        reason: "Say why the consignor is changing.",
      },
    });
    expect(
      checkConsignorForm({ kind: "lax", client: null, reason: "x".repeat(501) }, client),
    ).toEqual({ ok: false, errors: { reason: "Keep the reason to 500 characters or fewer." } });
    expect(
      checkConsignorForm({ kind: "lax", client: null, reason: " Bought outright " }, client),
    ).toEqual({
      ok: true,
      body: { consignor: { kind: "lax" }, reason: "Bought outright", expectedCurrentId: client.id },
    });
  });

  it("keeps only the fields it knows from shop-api's issues, first message each", () => {
    expect(
      consignorErrorsFromIssues([
        { field: "reason", message: "First" },
        { field: "reason", message: "Second" },
        { field: "places", message: "Not here" },
        "junk",
      ]),
    ).toEqual({ reason: "First" });
  });
});

describe("the All list's Consignor filter", () => {
  const consignors = [
    { value: "none", label: "Not set", count: 4 },
    { value: PARTY, label: "Ivo Marren", count: 2 },
  ];

  it("lists each choice with its count, and names the active one", () => {
    expect(consignorFilterOptions(consignors)).toEqual([
      { value: "none", label: "Not set (4)" },
      { value: PARTY, label: "Ivo Marren (2)" },
    ]);
    expect(consignorFilterChip(PARTY, consignors)).toBe("Consignor: Ivo Marren");
    expect(consignorFilterChip(OTHER, consignors)).toBe("Consignor: Unknown client");
  });
});
