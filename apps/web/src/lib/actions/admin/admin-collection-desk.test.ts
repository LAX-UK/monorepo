import { DESK_BOOKING, DESK_LOT_A, deskBooking } from "@/lib/admin/collections/desk.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  deny: vi.fn(),
  revalidate: vi.fn(),
  stepUp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: mocks.deny,
}));
vi.mock("@/lib/auth/step-up/staff-step-up.server", () => ({
  isStaffStepUpResponse: mocks.stepUp,
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => mocks.fetch(...args),
}));

const {
  bookForClientAction,
  handOverCollectionAction,
  markNotCollectedAction,
  rebookCollectionAction,
  undoHandOverCollectionAction,
} = await import("./admin-collection-desk");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const VIEW = JSON.parse(JSON.stringify(deskBooking()));
const KEY = crypto.randomUUID();
const BODY = { lotIds: [DESK_LOT_A], idCheck: { confirmed: true, type: "passport" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockResolvedValue(null);
  mocks.stepUp.mockResolvedValue(false);
});

describe("hand-over action", () => {
  it("sends nothing when the person may not change collections", async () => {
    mocks.deny.mockResolvedValue({ ok: false, error: "No", status: 403 });
    expect(await handOverCollectionAction(DESK_BOOKING, BODY, KEY)).toMatchObject({ ok: false });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing for an ID number, an unticked check or a bad key", async () => {
    for (const bad of [
      { ...BODY, idCheck: { ...BODY.idCheck, number: "123" } },
      { ...BODY, idCheck: { confirmed: false, type: "passport" } },
      { ...BODY, lotIds: [] },
    ]) {
      expect(await handOverCollectionAction(DESK_BOOKING, bad, KEY)).toMatchObject({
        ok: false,
        status: 400,
      });
    }
    expect(await handOverCollectionAction(DESK_BOOKING, BODY, "short")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends the ticked lots, the ID type and the attempt's idempotency key, then refreshes", async () => {
    mocks.fetch.mockResolvedValue(json(200, { data: VIEW }));
    const result = await handOverCollectionAction(DESK_BOOKING, BODY, KEY);
    expect(result).toMatchObject({ ok: true });
    const [path, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/admin/collection-desk/bookings/${DESK_BOOKING}/hand-over`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual(BODY);
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/collections");
  });

  it("keeps the code and the lots at fault of a refusal", async () => {
    mocks.fetch.mockResolvedValue(
      json(409, { error: "not_released", message: "Release first", lotIds: [DESK_LOT_A] }),
    );
    expect(await handOverCollectionAction(DESK_BOOKING, BODY, KEY)).toMatchObject({
      ok: false,
      status: 409,
      errorCode: "not_released",
      meta: { lotIds: [DESK_LOT_A] },
    });
  });

  it("asks for a fresh sign-in when the API does", async () => {
    mocks.stepUp.mockResolvedValue(true);
    mocks.fetch.mockResolvedValue(json(403, { error: "step_up_required" }));
    expect(await handOverCollectionAction(DESK_BOOKING, BODY, KEY)).toMatchObject({
      ok: false,
      errorCode: "step_up_required",
    });
  });

  it("says nothing was changed when the desk cannot be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("down"));
    expect(await handOverCollectionAction(DESK_BOOKING, BODY, KEY)).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});

describe("the other desk actions", () => {
  it("undo and not collected carry their own idempotency keys", async () => {
    mocks.fetch.mockImplementation(async () => json(200, { data: VIEW }));
    await undoHandOverCollectionAction(DESK_BOOKING, KEY);
    await markNotCollectedAction(DESK_BOOKING, KEY);
    const paths = mocks.fetch.mock.calls.map((c) => c[0]);
    expect(paths).toEqual([
      `/admin/collection-desk/bookings/${DESK_BOOKING}/undo-hand-over`,
      `/admin/collection-desk/bookings/${DESK_BOOKING}/not-collected`,
    ]);
    for (const call of mocks.fetch.mock.calls) {
      expect(((call[1] as RequestInit).headers as Record<string, string>)["Idempotency-Key"]).toBe(
        KEY,
      );
    }
  });

  it("a rebook sends the version and the override reason", async () => {
    mocks.fetch.mockResolvedValue(json(200, { data: VIEW }));
    const body = {
      version: 2,
      slotStart: "2026-11-13T10:00:00.000Z",
      override: { reason: "Client phoned" },
    };
    await rebookCollectionAction(DESK_BOOKING, body);
    const [path, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/admin/collection-desk/bookings/${DESK_BOOKING}/rebook`);
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("a booking for a client needs the client's authorisation for a third party in its body", async () => {
    const body = {
      legalEntityId: "d0000000-0000-4000-8000-0000000000d1",
      lotIds: [DESK_LOT_A],
      slotStart: "2026-11-13T10:00:00.000Z",
      collector: { kind: "third_party", name: "Sam Shipper", authorised: true },
      idempotencyKey: "desk-key-12345",
    };
    mocks.fetch.mockResolvedValue(json(201, { data: VIEW }));
    expect(await bookForClientAction(body)).toMatchObject({ ok: true });
    expect(await bookForClientAction({ ...body, extra: 1 })).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
