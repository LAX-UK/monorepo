import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const apiFetch = vi.fn();
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { findRecordAccount, restoreAccount } = await import("./remembered-account.server");

const ORG_ID = "22222222-2222-4222-8222-222222222222";

describe("findRecordAccount", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("names the owning account", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ data: { legalEntityId: ORG_ID } })));
    await expect(findRecordAccount("consignment", "s1")).resolves.toEqual({
      kind: "ok",
      legalEntityId: ORG_ID,
    });
  });

  it("tells a missing record from no access", async () => {
    apiFetch.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    await expect(findRecordAccount("purchase", "l1")).resolves.toEqual({ kind: "not_found" });
    apiFetch.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    await expect(findRecordAccount("purchase", "l1")).resolves.toEqual({ kind: "no_access" });
  });

  it.each([429, 500, 503])("reports a %s as an outage, never as not found", async (status) => {
    apiFetch.mockResolvedValue(new Response("{}", { status }));
    await expect(findRecordAccount("consignment", "s1")).resolves.toEqual({ kind: "unavailable" });
  });

  it("reports an unreachable API as an outage", async () => {
    apiFetch.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(findRecordAccount("consignment", "s1")).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("restoreAccount", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("returns the API's choice", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { accountId: ORG_ID, lostOrganisation: null } })),
    );
    await expect(restoreAccount(ORG_ID)).resolves.toEqual({
      ok: true,
      restored: { accountId: ORG_ID, lostOrganisation: null },
    });
  });

  it("never guesses when the API cannot answer", async () => {
    apiFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(restoreAccount(ORG_ID)).resolves.toEqual({ ok: false });
    apiFetch.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(restoreAccount(ORG_ID)).resolves.toEqual({ ok: false });
  });
});
