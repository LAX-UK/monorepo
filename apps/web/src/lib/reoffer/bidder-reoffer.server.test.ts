import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { listBidderReoffers, loadBidderReoffer, reofferBoughtOn } = await import(
  "./bidder-reoffer.server"
);

const ID = "11111111-1111-4111-8111-111111111111";
const view = {
  id: ID,
  lotId: "22222222-2222-4222-8222-222222222222",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  saleId: null,
  lotImage: null,
  lotEndedAt: "2026-10-29T18:00:00.000Z",
  status: "offered",
  price: {
    hammerMinor: 8_200_000,
    buyersPremiumMinor: 2_050_000,
    vatOnPremiumMinor: null,
    vatOnLotMinor: null,
    artistsResaleRightMinor: null,
    totalMinor: 10_250_000,
  },
  endsAt: "2026-11-14T17:00:00.000Z",
  respondedAt: null,
  invoiceDueAt: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("the bidder's offer reads", () => {
  beforeEach(() => fetchMock.mockReset());

  it("reads one offer from the acting account's own route", async () => {
    fetchMock.mockResolvedValue(json({ data: view }));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "ok", view });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/legal-entities/reoffers/${ID}`);
  });

  it("tells each way an offer cannot be shown apart", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "offer_not_found" }, 404));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "not_found" });
    fetchMock.mockResolvedValueOnce(json({ error: "forbidden" }, 403));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "forbidden" });
    fetchMock.mockResolvedValueOnce(json({}, 500));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "error" });
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "error" });
  });

  it("treats a shape that leaks another party's field as a failure", async () => {
    fetchMock.mockResolvedValue(json({ data: { ...view, sellerLegalEntityId: "e9" } }));
    expect(await loadBidderReoffer(ID)).toEqual({ kind: "error" });
  });

  it("lists nothing rather than failing the page it sits on", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [view] }));
    expect(await listBidderReoffers()).toEqual([view]);
    fetchMock.mockResolvedValueOnce(json({}, 500));
    expect(await listBidderReoffers()).toEqual([]);
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await listBidderReoffers()).toEqual([]);
  });

  it("gives the day a purchase was bought by accepting an offer, and nothing for any other", async () => {
    const accepted = { ...view, status: "accepted", respondedAt: "2026-11-12T09:00:00.000Z" };
    fetchMock.mockResolvedValue(json({ data: [view, accepted] }));
    expect(await reofferBoughtOn(view.lotId)).toBe("2026-11-12T09:00:00.000Z");
    expect(await reofferBoughtOn("another-lot")).toBeNull();
  });
});
