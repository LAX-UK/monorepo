import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cookieValues = new Map<string, string>();
const setCookie = vi.fn((name: string, value: string) => cookieValues.set(name, value));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => setCookie(name, value),
  })),
}));

vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: async () => ({ id: "user-1", role: "client", staffRoles: [] }),
}));

const apiFetch = vi.fn();
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { GET } = await import("./route");

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const PERSONAL_ID = "11111111-1111-4111-8111-111111111111";

function restore(): Request {
  return new Request("https://lax.bid/restore-account?next=%2Fhome");
}

describe("/restore-account", () => {
  beforeEach(() => {
    cookieValues.clear();
    setCookie.mockClear();
    apiFetch.mockReset();
  });

  it("opens the account the API restored", async () => {
    apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { accountId: ORG_ID, lostOrganisation: null } })),
    );
    const res = await GET(restore());
    expect(res.headers.get("location")).toBe("/home");
    expect(cookieValues.get("lax_acting_legal_entity_id")).toBe(ORG_ID);
  });

  it.each([429, 500, 503])(
    "keeps the browser's choice and shows the retry state on a %s",
    async (status) => {
      cookieValues.set("lax_acting_legal_entity_id", ORG_ID);
      apiFetch.mockResolvedValue(new Response("{}", { status }));
      const res = await GET(restore());
      expect(res.headers.get("location")).toBe(
        `/switch-account/unavailable?retry=${encodeURIComponent("/restore-account?next=%2Fhome")}`,
      );
      expect(setCookie).not.toHaveBeenCalled();
      expect(cookieValues.get("lax_acting_legal_entity_id")).not.toBe(PERSONAL_ID);
    },
  );
});
