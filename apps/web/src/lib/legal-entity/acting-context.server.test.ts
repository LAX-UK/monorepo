import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cookieValues = new Map<string, string>();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: mockSet,
  })),
  headers: vi.fn(async () => requestHeaders),
}));

let requestHeaders = new Headers({ host: "lax.bid" });

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const mockAuthedFetch = vi.fn();

vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

import { isAccountsUnavailableError } from "./accounts-unavailable-error";
import {
  getActingLegalEntityHeader,
  lookupActingContext,
  requireActingContext,
  resolveActingContext,
} from "./acting-context.server";

const ACTING_COOKIE = "lax_acting_legal_entity_id";

const PERSONAL = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Personal",
  kind: "individual",
  subkind: "private_collector",
  status: "lead",
  role: "owner",
  isPrimaryAdmin: true,
};

const ORG = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Gallery One",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resolveActingContext", () => {
  beforeEach(() => {
    cookieValues.clear();
    mockSet.mockReset();
    mockAuthedFetch.mockReset();
    mockSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acts as personal on a new device, never writes the cookie, and asks for a restore", async () => {
    mockAuthedFetch.mockResolvedValue(respond(200, { data: [PERSONAL] }));

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: PERSONAL.id }),
      memberships: [expect.objectContaining({ id: PERSONAL.id })],
      needsRestore: true,
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("asks for a restore when the cookie names an organisation the person left", async () => {
    mockAuthedFetch.mockResolvedValue(respond(200, { data: [PERSONAL] }));
    cookieValues.set(ACTING_COOKIE, ORG.id);

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: PERSONAL.id }),
      needsRestore: true,
    });
  });

  it("keeps org acting from cookie when org module is enabled", async () => {
    mockAuthedFetch.mockResolvedValue(respond(200, { data: [PERSONAL, ORG] }));
    cookieValues.set(ACTING_COOKIE, ORG.id);

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: ORG.id, kind: "organisation" }),
      needsRestore: false,
    });
  });

  it("falls back to personal when org cookie set but kill switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    mockAuthedFetch.mockResolvedValue(respond(200, { data: [PERSONAL, ORG] }));
    cookieValues.set(ACTING_COOKIE, ORG.id);

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: PERSONAL.id, kind: "individual" }),
    });
  });

  it("keeps personal acting unchanged when kill switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    mockAuthedFetch.mockResolvedValue(respond(200, { data: [PERSONAL, ORG] }));
    cookieValues.set(ACTING_COOKIE, PERSONAL.id);

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: PERSONAL.id, kind: "individual" }),
    });
  });
});

describe("when the accounts cannot be read", () => {
  beforeEach(() => {
    cookieValues.clear();
    mockAuthedFetch.mockReset();
    cookieValues.set(ACTING_COOKIE, ORG.id);
  });

  it.each([
    [429, "rate_limited"],
    [500, "server_error"],
    [503, "server_error"],
  ] as const)(
    "reports a %s from /legal-entities/me as %s, not as Personal",
    async (status, reason) => {
      mockAuthedFetch.mockResolvedValue(respond(status, { error: "unavailable" }));

      await expect(lookupActingContext("client", [])).resolves.toEqual({ ok: false, reason });
      const thrown = await requireActingContext("client", []).catch((error: unknown) => error);
      expect(isAccountsUnavailableError(thrown)).toBe(true);
    },
  );

  it("sends a page to the retry state, back to the same page, with a redirect rather than an error", async () => {
    mockAuthedFetch.mockResolvedValue(respond(429, { error: "Too many requests" }));
    requestHeaders = new Headers({ "x-pathname": "/organisation", "x-search": "" });

    await expect(resolveActingContext("client", [])).rejects.toThrow(
      `NEXT_REDIRECT:/switch-account/unavailable?retry=${encodeURIComponent("/organisation")}`,
    );
  });

  it("keeps sending the browser's own account to the API, instead of acting for nobody", async () => {
    mockAuthedFetch.mockResolvedValue(respond(429, { error: "Too many requests" }));

    await expect(getActingLegalEntityHeader("client", [])).resolves.toEqual({
      "x-legal-entity-id": ORG.id,
    });
  });
});
