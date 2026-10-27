import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: async () => ({ id: "u1", role: "client", staffRole: null }),
}));
vi.mock("@/lib/data/http/hc-server", () => ({ getServerApiBase: () => "http://api.test" }));
vi.mock("@/lib/legal-entity/org-module-host.server", () => ({
  resolveOrgModuleEnabledFromRequest: async () => true,
}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: vi.fn(async (path: string) => {
    if (path.startsWith("/admin/impersonation/start")) {
      return new Response(JSON.stringify({ data: { actingCookie: "impersonation-cookie" } }));
    }
    if (path === "/legal-entities/me") {
      return new Response(JSON.stringify({ data: [{ id: PERSONAL_ID, kind: "individual" }] }));
    }
    return new Response(JSON.stringify({ data: { kind: "individual" } }));
  }),
}));

const PERSONAL_ID = vi.hoisted(() => "22222222-2222-4222-8222-222222222222");
const rememberAccount = vi.hoisted(() => vi.fn(async () => true));
vi.mock("./remembered-account.server", () => ({ rememberAccount }));

const { endAdminImpersonationAction, startAdminImpersonation, switchActingLegalEntity } =
  await import("./acting-context.actions");

const ENTITY_ID = "11111111-1111-4111-8111-111111111111";

function cookieOptions(call: number): Record<string, unknown> {
  return jar.set.mock.calls[call]?.[2] as Record<string, unknown>;
}

/** The acting entity cookie must never carry a Domain: the ATG White Label shares `.lax.bid`. */
describe("acting legal entity cookie writes", () => {
  beforeEach(() => {
    jar.set.mockReset();
    jar.get.mockReset();
    vi.stubEnv("COOKIE_DOMAIN", ".lax.bid");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets the switched entity host-only", async () => {
    await switchActingLegalEntity(ENTITY_ID);

    expect(jar.set).toHaveBeenCalledWith(
      "lax_acting_legal_entity_id",
      ENTITY_ID,
      expect.anything(),
    );
    expect(cookieOptions(0)).not.toHaveProperty("domain");
  });

  it("switches to the personal account explicitly, so a remembered organisation never returns", async () => {
    await switchActingLegalEntity(null);

    expect(jar.set).toHaveBeenCalledWith(
      "lax_acting_legal_entity_id",
      PERSONAL_ID,
      expect.anything(),
    );
    expect(cookieOptions(0)).not.toHaveProperty("domain");
  });

  it("remembers the switched account on the profile", async () => {
    rememberAccount.mockClear();
    await switchActingLegalEntity(ENTITY_ID);
    expect(rememberAccount).toHaveBeenCalledWith(ENTITY_ID);
  });

  it("sets the impersonation cookie host-only", async () => {
    await startAdminImpersonation(ENTITY_ID);

    expect(jar.set).toHaveBeenCalledWith(
      "lax_acting_legal_entity_id",
      encodeURIComponent("impersonation-cookie"),
      expect.anything(),
    );
    expect(cookieOptions(0)).not.toHaveProperty("domain");
  });

  it("clears the cookie host-only when impersonation ends", async () => {
    jar.get.mockReturnValue(undefined);

    await endAdminImpersonationAction();

    expect(cookieOptions(0)).toMatchObject({ maxAge: 0 });
    expect(cookieOptions(0)).not.toHaveProperty("domain");
  });
});
