import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => ({ map: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.map.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  assertAdminCapabilityForRedirect: async () => ({ ok: true }),
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { runPayoutSettlementAction } = await import("./admin-finance-mutations");

const ENTITY_ID = "c2d8e6f1-b373-4f8a-a2c1-05b7d4e699a4";
const KEY = "key-for-this-form-instance";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

function stepUp(): Response {
  return new Response(
    JSON.stringify({ error: "Recent sign-in required", code: "step_up_required" }),
    {
      status: 403,
    },
  );
}

async function redirectTarget(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("NEXT_REDIRECT:")) return message.slice("NEXT_REDIRECT:".length);
    throw error;
  }
  throw new Error("expected a redirect");
}

function sentHeaders(): Record<string, string> {
  return (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
}

describe("finance mutations", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    requestHeaders.map.clear();
    requestHeaders.map.set("host", "bid.example.test");
  });

  it("run settlement sends the form's Idempotency-Key", async () => {
    fetchMock.mockResolvedValue(ok());

    await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID, idempotencyKey: KEY })),
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/admin/payouts/run-settlement");
    expect(sentHeaders()["Idempotency-Key"]).toBe(KEY);
  });

  it("makes a key when the form carried none", async () => {
    fetchMock.mockResolvedValue(ok());

    await redirectTarget(() => runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })));

    expect(sentHeaders()["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends the person to re-authenticate when the API asks for a fresh sign-in", async () => {
    fetchMock.mockResolvedValue(stepUp());

    const target = await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
    );

    expect(target).toBe(
      `/api/auth/login?next=${encodeURIComponent("/admin/payouts/settlement")}&intent=reauth`,
    );
  });

  it("returns to the page the action was submitted from", async () => {
    requestHeaders.map.set(
      "referer",
      "https://bid.example.test/admin/payouts/settlement?legalEntityId=one",
    );
    fetchMock.mockResolvedValue(stepUp());

    const target = await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
    );

    expect(target).toBe(
      `/api/auth/login?next=${encodeURIComponent("/admin/payouts/settlement?legalEntityId=one")}&intent=reauth`,
    );
  });

  it("reports success with a code, never text", async () => {
    fetchMock.mockResolvedValue(ok());
    const target = await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
    );
    expect(target).toBe("/admin/payouts/settlement?result=started");
  });

  it("maps a refused run to a fixed code and drops the API's wording", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "<b>internal detail</b>" }), { status: 409 }),
    );
    const target = await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
    );
    expect(target).toBe("/admin/payouts/settlement?result=blocked");
  });

  it("maps a server failure to the retry code", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 502 }));
    const target = await redirectTarget(() =>
      runPayoutSettlementAction(form({ legalEntityId: ENTITY_ID })),
    );
    expect(target).toBe("/admin/payouts/settlement?result=failed");
  });

  it("asks for a seller when none was chosen", async () => {
    const target = await redirectTarget(() => runPayoutSettlementAction(form({})));
    expect(target).toBe("/admin/payouts/settlement?result=missing_seller");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
