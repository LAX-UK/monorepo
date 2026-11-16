import { STORAGE, STORAGE_VENUE } from "@/lib/admin/collections/storage.fixture";
import { COLLECTION_STORAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
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

const {
  cancelStorageTermsAction,
  editStorageTermsAction,
  scheduleStorageTermsAction,
  setStorageChargingAction,
} = await import("./admin-collection-storage");

const TERMS_ID = "d0000000-0000-4000-8000-0000000000c1";

const TERMS = {
  effectiveFrom: "2026-12-01",
  reason: "Rates for 2027",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockResolvedValue(null);
});

describe("storage actions: who may send them", () => {
  it.each([
    ["schedule", () => scheduleStorageTermsAction(STORAGE_VENUE, TERMS)],
    ["edit", () => editStorageTermsAction(STORAGE_VENUE, TERMS_ID, TERMS)],
    ["cancel", () => cancelStorageTermsAction(STORAGE_VENUE, TERMS_ID, { reason: "x" })],
    [
      "switch",
      () => setStorageChargingAction(STORAGE_VENUE, { raiseInvoices: false, reason: "x" }),
    ],
  ])("%s sends nothing for someone without Finance or Administrator", async (_name, send) => {
    mocks.deny.mockResolvedValue({ ok: false, error: "You do not have permission", status: 403 });
    expect(await send()).toMatchObject({ ok: false, status: 403 });
    expect(mocks.deny).toHaveBeenCalledWith(COLLECTION_STORAGE_ACCESS);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("storage actions: what is sent", () => {
  it("sends a schedule to the place's storage terms and answers with the tab", async () => {
    mocks.fetch.mockResolvedValue(json(200, { data: STORAGE }));
    const result = await scheduleStorageTermsAction(STORAGE_VENUE, TERMS);
    expect(result).toEqual({ ok: true, data: STORAGE });
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/admin/collections/${STORAGE_VENUE}/storage/terms`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(TERMS);
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/collections");
  });

  it("puts an edit, posts a cancel and puts the switch at their own paths", async () => {
    mocks.fetch.mockImplementation(async () => json(200, { data: STORAGE }));
    await editStorageTermsAction(STORAGE_VENUE, TERMS_ID, TERMS);
    await cancelStorageTermsAction(STORAGE_VENUE, TERMS_ID, { reason: "Wrong date" });
    await setStorageChargingAction(STORAGE_VENUE, { raiseInvoices: true, reason: "VAT agreed" });
    expect(
      mocks.fetch.mock.calls.map(([url, init]) => [(init as RequestInit).method, url]),
    ).toEqual([
      ["PUT", `/admin/collections/${STORAGE_VENUE}/storage/terms/${TERMS_ID}`],
      ["POST", `/admin/collections/${STORAGE_VENUE}/storage/terms/${TERMS_ID}/cancel`],
      ["PUT", `/admin/collections/${STORAGE_VENUE}/storage/charging`],
    ]);
  });

  it("refuses a body the API would refuse, without sending it", async () => {
    const result = await scheduleStorageTermsAction(STORAGE_VENUE, {
      ...TERMS,
      standardDailyPence: 350.5,
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("storage actions: refusals", () => {
  it("hands a stale sign-in to the page as the step-up code", async () => {
    mocks.fetch.mockResolvedValue(json(403, { error: "forbidden", code: "step_up_required" }));
    const result = await setStorageChargingAction(STORAGE_VENUE, {
      raiseInvoices: false,
      reason: "Pause",
    });
    expect(result).toMatchObject({ ok: false, status: 403, errorCode: "step_up_required" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("passes the API's sentence, code and field issues through", async () => {
    mocks.fetch.mockResolvedValue(
      json(422, {
        error: "start_too_late",
        message: "Choose a date within the next 2 years.",
        issues: [{ field: "effectiveFrom", message: "Choose a date within the next 2 years." }],
      }),
    );
    const result = await scheduleStorageTermsAction(STORAGE_VENUE, TERMS);
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      error: "Choose a date within the next 2 years.",
      errorCode: "start_too_late",
      meta: { issues: [{ field: "effectiveFrom" }] },
    });
  });

  it("says nothing changed when the API cannot be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    const result = await cancelStorageTermsAction(STORAGE_VENUE, TERMS_ID, { reason: "x" });
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      error: "We couldn't reach the storage terms. Nothing was changed. Try again.",
    });
  });
});
