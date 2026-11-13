import { buildContact } from "@auction/accounting-domain";
import { rawOrgSettings } from "@auction/accounting-zoho-books/testing";
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
