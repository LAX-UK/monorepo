import { buildContact } from "@auction/accounting-domain";
import { BOOKS_ORGANISATIONS } from "@auction/accounting-zoho-books";
import { BID_ORG_ID, rawOrgSettings } from "@auction/accounting-zoho-books/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBooksAccountingAdapters } from "./create-books-accounting-adapters.js";

const config = (environment: "test" | "live" = "test") => {
  const raw = rawOrgSettings() as Record<string, Record<string, unknown>>;
  return JSON.stringify(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { ...v, environment }])),
  );
};

describe("Books accounting adapters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds nothing without organisation settings, so nothing runs", () => {
    expect(createBooksAccountingAdapters({})).toBeNull();
    expect(createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: "  " })).toBeNull();
  });

  it("refuses broken settings when the worker starts", () => {
    expect(() => createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: "{" })).toThrow(
      "ZOHO_BOOKS_ORG_CONFIG is not valid JSON",
    );
    expect(() => createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: "{}" })).toThrow();
  });

  it("builds the rehearsal only, even for a live organisation: no setting enables a write", () => {
    for (const environment of ["test", "live"] as const) {
      const built = createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config(environment) });
      expect(Object.keys(built?.byMode ?? {})).toEqual(["dry_run"]);
      expect(built?.transientErrorPrefixes).toContain("zoho_books_rate_limited_");
    }
  });

  it("the rehearsal reaches no organisation, and nothing is bound for a writing mode by default", () => {
    const built = createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config("live") });
    expect(built?.byMode.dry_run?.destination.destinationFor("bid")).toEqual({ kind: "none" });
    expect(built?.destinations).toEqual({});
  });

  it("binds nothing by default: the organisations each mode may reach are named in code, and none yet", () => {
    expect(BOOKS_ORGANISATIONS).toEqual({});
    expect(
      createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config("test") })?.destinations,
    ).toEqual({});
  });

  it("binds a test_org product to its test organisation, and refuses to start when the settings call it live", () => {
    const organisations = { test_org: { bid: BID_ORG_ID } };
    expect(
      createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config("test") }, organisations)
        ?.destinations,
    ).toEqual(organisations);
    expect(() =>
      createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config("live") }, organisations),
    ).toThrow("zoho_books_config_destination_binding_wrong_environment");
  });

  it("refuses to start when the settings declare the live organisation a test one", () => {
    // The live organisation is named once, under live: configuring it as `test` cannot make it a
    // rehearsal target, whatever else is typed.
    expect(() =>
      createBooksAccountingAdapters(
        { ZOHO_BOOKS_ORG_CONFIG: config("test") },
        { live: { bid: BID_ORG_ID } },
      ),
    ).toThrow("zoho_books_config_destination_binding_wrong_environment");
  });

  it("the rehearsal answers without any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const built = createBooksAccountingAdapters({ ZOHO_BOOKS_ORG_CONFIG: config() });
    const contact = buildContact({ product: "bid", sourceId: "buyer-1", name: "A Buyer" });
    if (!contact.ok) throw new Error(contact.refusal.message);
    const outcome = await built?.byMode.dry_run?.contacts.upsertContact(contact.value);
    expect(outcome?.status).toBe("issued");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
