import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
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
    return new Response(JSON.stringify({ data: { kind: "individual" } }));
  }),
}));

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

  it("clears the cookie host-only", async () => {
    await switchActingLegalEntity(null);

    expect(cookieOptions(0)).toMatchObject({ maxAge: 0 });
    expect(cookieOptions(0)).not.toHaveProperty("domain");
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
