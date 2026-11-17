import {
  CLERK_COMMAND_SESSION_EXPIRED,
  CLERK_COMMAND_UNREACHABLE,
  clerkAdvance,
  clerkDisplayApprove,
  clerkDisplayClearOverlay,
  clerkDisplayOverlay,
  clerkHammer,
  clerkLotSnapshot,
  clerkNoSale,
  clerkPlacePaddleBid,
  clerkPlaceTelephoneBid,
  clerkTelephoneLine,
  setClerkCommandFetchForTests,
} from "@/features/saleroom/lib/clerk-commands.client";
import { afterEach, describe, expect, it, vi } from "vitest";

const SALE = "11111111-1111-4111-8111-111111111111";
const LOT = "22222222-2222-4222-8222-222222222222";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response | Error) {
  const fetch = vi.fn(async (_input: string, _init: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  setClerkCommandFetchForTests(fetch);
  return fetch;
}

afterEach(() => {
  setClerkCommandFetchForTests(null);
});

describe("clerk saleroom commands", () => {
  it("sends Hammer to the API through the BFF, never to the page as a server action", async () => {
    const fetch = stubFetch(json(200, { data: {} }));

    await expect(clerkHammer({ saleId: SALE, lotId: LOT })).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`/api/bff/admin/sales/${SALE}/saleroom/hammer`);
    expect(init?.method).toBe("POST");
    // A server action is a POST to the page with a `Next-Action` header; this is not one.
    expect(new Headers(init?.headers).has("next-action")).toBe(false);
    // It names the lot the clerk saw, so it can never end a lot that came up since.
    expect(init?.body).toBe(JSON.stringify({ lotId: LOT }));
  });

  it("reads the lot's price and reserve as the server holds them now", async () => {
    const snapshot = {
      lotId: LOT,
      status: "active",
      currentPrice: "950.00",
      reservePrice: "900.00",
    };
    const fetch = stubFetch(json(200, { data: snapshot }));

    await expect(clerkLotSnapshot({ saleId: SALE, lotId: LOT })).resolves.toEqual({
      ok: true,
      data: snapshot,
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`/api/bff/admin/sales/${SALE}/saleroom/lots/${LOT}`);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("sends each command to its API path with its body", async () => {
    const fetch = stubFetch(json(200, { data: {} }));

    await clerkAdvance({ saleId: SALE, lotId: LOT });
    await clerkNoSale({ saleId: SALE, lotId: LOT });
    await clerkDisplayApprove({ saleId: SALE, userCode: " ab12cd " });
    await clerkDisplayOverlay({
      saleId: SALE,
      kind: "announcement",
      message: "  Lot 12 withdrawn ",
    });
    await clerkDisplayClearOverlay({ saleId: SALE });
    await clerkTelephoneLine({ saleId: SALE, bookingId: "b-1", lotId: LOT, step: "start-line" });

    const calls = fetch.mock.calls.map(([url, init]) => [url, init.method, init.body ?? null]);
    expect(calls).toEqual([
      [`/api/bff/admin/sales/${SALE}/saleroom/advance`, "POST", JSON.stringify({ lotId: LOT })],
      [`/api/bff/admin/sales/${SALE}/saleroom/no-sale`, "POST", JSON.stringify({ lotId: LOT })],
      [
        `/api/bff/admin/sales/${SALE}/saleroom/display/approve`,
        "POST",
        JSON.stringify({ userCode: "AB12CD" }),
      ],
      [
        `/api/bff/admin/sales/${SALE}/saleroom/display/overlay`,
        "POST",
        JSON.stringify({ kind: "announcement", message: "Lot 12 withdrawn" }),
      ],
      [`/api/bff/admin/sales/${SALE}/saleroom/display/overlay`, "DELETE", null],
      [
        `/api/bff/admin/sales/${SALE}/telephone-bookings/b-1/start-line`,
        "POST",
        JSON.stringify({ lotId: LOT }),
      ],
    ]);
  });

  it("places paddle and telephone bids and returns the new bid id", async () => {
    const fetch = stubFetch(json(201, { data: { id: "bid-9" } }));

    await expect(
      clerkPlacePaddleBid({ saleId: SALE, lotId: LOT, paddleNumber: 42, amount: 10650 }),
    ).resolves.toEqual({ ok: true, data: { bidId: "bid-9" } });
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/bff/admin/saleroom/paddle-bids");

    fetch.mockResolvedValueOnce(json(201, { data: { id: "bid-10" } }));
    await expect(
      clerkPlaceTelephoneBid({
        lotId: LOT,
        buyerUserId: "user-1",
        buyerLegalEntityId: "33333333-3333-4333-8333-333333333333",
        amount: 10900,
        telephoneBookingId: "44444444-4444-4444-8444-444444444444",
      }),
    ).resolves.toEqual({ ok: true, data: { bidId: "bid-10" } });
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/bff/admin/saleroom/telephone-bids");
  });

  it("returns the API's refusal as a result instead of throwing", async () => {
    stubFetch(json(409, { error: "No lot on the block", code: "no_current_lot" }));

    await expect(clerkHammer({ saleId: SALE, lotId: LOT })).resolves.toEqual({
      ok: false,
      error: "No lot on the block",
      status: 409,
      errorCode: "no_current_lot",
    });
  });

  it("passes on the limit when a limit refused a paddle bid", async () => {
    const refusal = { kind: "paddle", limit: "5000.00", available: null };
    stubFetch(
      json(403, { error: "Bid exceeds authorized limit", code: "bid_limit_exceeded", refusal }),
    );

    await expect(
      clerkPlacePaddleBid({ saleId: SALE, lotId: LOT, paddleNumber: 142, amount: 6000 }),
    ).resolves.toEqual({
      ok: false,
      error: "Bid exceeds authorized limit",
      status: 403,
      errorCode: "bid_limit_exceeded",
      meta: { refusal },
    });
  });

  it("turns a 404 with no JSON body into a result with the fallback message", async () => {
    stubFetch(new Response("<html>Not found</html>", { status: 404 }));

    await expect(clerkHammer({ saleId: SALE, lotId: LOT })).resolves.toEqual({
      ok: false,
      error: "Hammer failed",
      status: 404,
    });
  });

  it("says the session ended when the BFF has no session", async () => {
    stubFetch(json(401, { error: "session_required" }));

    const result = await clerkHammer({ saleId: SALE, lotId: LOT });
    expect(result).toMatchObject({ ok: false, error: CLERK_COMMAND_SESSION_EXPIRED, status: 401 });
  });

  it("never sends Hammer twice when the network fails: it reports and leaves the retry to the clerk", async () => {
    const fetch = stubFetch(new TypeError("Failed to fetch"));

    await expect(clerkHammer({ saleId: SALE, lotId: LOT })).resolves.toEqual({
      ok: false,
      error: CLERK_COMMAND_UNREACHABLE,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
