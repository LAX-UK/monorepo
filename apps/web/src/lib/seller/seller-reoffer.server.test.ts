import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { listSellerReoffers, loadSellerReoffer } = await import("./seller-reoffer.server");

const ID = "11111111-1111-4111-8111-111111111111";
const view = {
  id: ID,
  lotId: "22222222-2222-4222-8222-222222222222",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  lotEndedAt: "2026-10-29T18:00:00.000Z",
  status: "awaiting_seller",
  consentStatus: "requested",
  offerMinor: 8_200_000,
  // Settlement's split: a 25% premium on the hammer, and a 5% fee on that total.
  proceeds: {
    offerSaleMinor: 10_250_000,
    offerProceedsMinor: 9_737_500,
    originalHammerMinor: 8_800_000,
    originalProceedsMinor: 10_450_000,
    commissionBps: 1500,
  },
  reserveMinor: null,
  belowReserve: false,
  answerDueAt: "2026-11-13T17:00:00.000Z",
  answeredAt: null,
  answeredBy: null,
  declinePreference: null,
  offerEndsAt: null,
  soldAt: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("the seller's re-offer reads", () => {
  beforeEach(() => fetchMock.mockReset());

  it("reads one request from the acting account's own route", async () => {
    fetchMock.mockResolvedValue(json({ data: view }));
    expect(await loadSellerReoffer(ID)).toEqual({ kind: "ok", view });
    expect(fetchMock).toHaveBeenCalledWith(`/legal-entities/reoffer-requests/${ID}`);
  });

  it.each([
    [404, "not_found"],
    [403, "forbidden"],
    [500, "error"],
  ])("answers %s as %s, so the page can say which", async (status, kind) => {
    fetchMock.mockResolvedValue(json({ error: "x" }, status));
    expect(await loadSellerReoffer(ID)).toEqual({ kind });
  });

  it("treats an unreadable answer or a failed call as an error, never as a request", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { ...view, lotTitle: 7 } }));
    expect(await loadSellerReoffer(ID)).toEqual({ kind: "error" });
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await loadSellerReoffer(ID)).toEqual({ kind: "error" });
  });

  it("lists the requests, and lists nothing when they cannot be read", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [view] }));
    expect(await listSellerReoffers()).toEqual([view]);
    fetchMock.mockResolvedValueOnce(json({ error: "x" }, 403));
    expect(await listSellerReoffers()).toEqual([]);
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await listSellerReoffers()).toEqual([]);
  });
});
