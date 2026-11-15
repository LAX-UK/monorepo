import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  deny: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
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
  addCollectionExceptionAction,
  removeCollectionExceptionAction,
  saveCollectionSettingsAction,
} = await import("./admin-collections");

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const EXCEPTION = "d0000000-0000-4000-8000-0000000000b1";

const SAVE = {
  version: "2026-11-01T09:00:00.000Z",
  onlineBookingEnabled: true,
  visitMinutes: 30,
  placesPerSlot: 2,
  noticeCutoffLocal: "16:00",
  noticeWorkingDays: 1,
  windowDays: 28,
  closeOnSaleDays: true,
  undoHandOverMinutes: 15,
  maxActiveVisits: 5,
  freeStorageDays: null,
  bookingEmail: null,
  hours: [{ weekday: 1, opensLocal: "10:00", closesLocal: "19:00" }],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deny.mockResolvedValue(null);
});

describe("collection settings actions", () => {
  it("send nothing when the person may not change collections", async () => {
    mocks.deny.mockResolvedValue({ ok: false, error: "You do not have permission", status: 403 });
    const result = await saveCollectionSettingsAction(VENUE, SAVE);
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("send nothing for a body that is not the right shape", async () => {
    const result = await saveCollectionSettingsAction(VENUE, { ...SAVE, visitMinutes: "thirty" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("send a save to the venue's address and refresh the page's data", async () => {
    mocks.fetch.mockResolvedValue(
      json(200, {
        data: {
          settings: {
            venueId: VENUE,
            version: "2026-11-09T12:00:00.000Z",
            onlineBookingEnabled: true,
            bookingEmail: null,
            visitMinutes: 30,
            placesPerSlot: 2,
            noticeCutoffLocal: "16:00",
            noticeWorkingDays: 1,
            windowDays: 28,
            closeOnSaleDays: true,
            undoHandOverMinutes: 15,
            maxActiveVisits: 5,
            freeStorageDays: null,
            hours: [],
            exceptions: [],
            nextSaleDay: null,
          },
          affected: [],
          cancelled: 0,
        },
      }),
    );
    const result = await saveCollectionSettingsAction(VENUE, SAVE);
    expect(result.ok).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith(
      `/admin/collections/${VENUE}`,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/collections");
  });

  it("pass on the bookings a change would affect, with the API's code", async () => {
    const affected = [
      { bookingId: "b1", reference: "COL-1", start: "x", end: "y", reason: "closed" },
    ];
    mocks.fetch.mockResolvedValue(
      json(409, { error: "bookings_affected", message: "Some bookings fall outside.", affected }),
    );
    const result = await addCollectionExceptionAction(VENUE, {
      kind: "closure",
      startsOn: "2026-12-24",
      endsOn: "2026-12-24",
      opensLocal: null,
      closesLocal: null,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      errorCode: "bookings_affected",
      meta: { affected },
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("hand a stale sign-in to the page as the step-up code", async () => {
    mocks.fetch.mockResolvedValue(json(403, { error: "forbidden", code: "step_up_required" }));
    const result = await removeCollectionExceptionAction(VENUE, EXCEPTION, {});
    expect(result).toMatchObject({ ok: false, errorCode: "step_up_required" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      `/admin/collections/${VENUE}/exceptions/${EXCEPTION}/remove`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("say nothing changed when the API cannot be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("network"));
    const result = await saveCollectionSettingsAction(VENUE, SAVE);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect((result as { error: string }).error).toContain("Nothing was changed");
  });
});
