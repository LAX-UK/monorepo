import { OVERDUE, OVERDUE_LOT } from "@/lib/admin/collections/not-collected.fixture";
import { STORAGE_VENUE } from "@/lib/admin/collections/storage.fixture";
import { COLLECTIONS_ACCESS, COLLECTION_STORAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  deny: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: mocks.deny,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => mocks.fetch(...args),
}));

const { extendLotStorageAction, waiveLotStorageAction } = await import(
  "./admin-collection-overdue"
);

const LOT = OVERDUE_LOT.lotId;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockResolvedValue(null);
});

describe("lot storage actions: who may send them", () => {
  it("extends only for Fulfilment and Administrators", async () => {
    mocks.deny.mockResolvedValue({ ok: false, error: "You do not have permission", status: 403 });
    const result = await extendLotStorageAction(STORAGE_VENUE, LOT, { days: 7, reason: "x" });
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.deny).toHaveBeenCalledWith(COLLECTIONS_ACCESS);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("waives only for Finance and Administrators", async () => {
    mocks.deny.mockResolvedValue({ ok: false, error: "You do not have permission", status: 403 });
    const result = await waiveLotStorageAction(STORAGE_VENUE, LOT, { reason: "x" });
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.deny).toHaveBeenCalledWith(COLLECTION_STORAGE_ACCESS);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("lot storage actions: what is sent", () => {
  it("posts an extension to the lot and answers with the refreshed list", async () => {
    mocks.fetch.mockResolvedValue(json(200, { data: OVERDUE }));
    const result = await extendLotStorageAction(STORAGE_VENUE, LOT, {
      days: 7,
      reason: "Buyer abroad",
    });
    expect(result).toEqual({ ok: true, data: OVERDUE });
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/admin/collections/${STORAGE_VENUE}/storage/lots/${LOT}/extension`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ days: 7, reason: "Buyer abroad" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/collections");
  });

  it("posts a waiver to the lot", async () => {
    mocks.fetch.mockResolvedValue(json(200, { data: OVERDUE }));
    await waiveLotStorageAction(STORAGE_VENUE, LOT, { reason: "Our delay" });
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/admin/collections/${STORAGE_VENUE}/storage/lots/${LOT}/waiver`);
    expect(JSON.parse(String(init.body))).toEqual({ reason: "Our delay" });
  });

  it.each([
    ["no days", { days: 0, reason: "x" }],
    ["over 30 days", { days: 31, reason: "x" }],
    ["part of a day", { days: 1.5, reason: "x" }],
    ["no reason", { days: 3, reason: "  " }],
  ])("sends nothing for an extension with %s", async (_name, body) => {
    const result = await extendLotStorageAction(STORAGE_VENUE, LOT, body);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("lot storage actions: refusals", () => {
  it("hands a stale sign-in on a waiver to the page as the step-up code", async () => {
    mocks.fetch.mockResolvedValue(json(403, { error: "forbidden", code: "step_up_required" }));
    const result = await waiveLotStorageAction(STORAGE_VENUE, LOT, { reason: "Goodwill" });
    expect(result).toMatchObject({ ok: false, status: 403, errorCode: "step_up_required" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("passes the cap refusal's sentence and field through", async () => {
    mocks.fetch.mockResolvedValue(
      json(409, {
        error: "extension_cap_reached",
        message: "This lot can have up to 3 more days.",
        issues: [{ field: "days", message: "This lot can have up to 3 more days." }],
      }),
    );
    const result = await extendLotStorageAction(STORAGE_VENUE, LOT, { days: 7, reason: "x" });
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      errorCode: "extension_cap_reached",
      meta: { issues: [{ field: "days" }] },
    });
  });

  it("says nothing changed when the API cannot be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    const result = await waiveLotStorageAction(STORAGE_VENUE, LOT, { reason: "x" });
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      error: "We couldn't reach the lot's storage. Nothing was changed. Try again.",
    });
  });
});
