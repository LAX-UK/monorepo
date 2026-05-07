import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLotRoutes } from "./lots.js";

const lotId = "11111111-1111-4111-8111-111111111111";
const bidderId = "bidder-1";

function mount(user: { id: string; role: string } | null) {
  const app = new Hono();
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: {
      getById: vi.fn().mockResolvedValue({ id: lotId, auctionType: "english", status: "active" }),
    },
    bidService: {
      listForLot: vi.fn().mockResolvedValue([
        {
          id: "bid-1",
          lotId,
          placedByUserId: bidderId,
          buyerLegalEntityId: "22222222-2222-4222-8222-222222222222",
          amount: "100.00",
          isWinning: true,
          isAutoBid: false,
          maxAutoBidAmount: null,
          createdAt: new Date(),
        },
      ]),
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(user),
  };
  app.route("/lots", createLotRoutes(container, authenticator));
  return app;
}

describe("lot bid history privacy", () => {
  it("redacts bidder user ids for anonymous readers", async () => {
    const res = await mount(null).request(`/lots/${lotId}/bids`);
    const body = (await res.json()) as { data: Array<{ placedByUserId: string | null; bidderRef: string }> };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBeNull();
    expect(body.data[0]?.bidderRef).toMatch(/^[a-f0-9]{16}$/);
  });

  it("keeps bidder user id visible to the bidder", async () => {
    const res = await mount({ id: bidderId, role: "client" }).request(`/lots/${lotId}/bids`);
    const body = (await res.json()) as { data: Array<{ placedByUserId: string | null }> };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBe(bidderId);
  });

  it("keeps bidder user id visible to administrators", async () => {
    const res = await mount({ id: "admin-1", role: "administrator" }).request(`/lots/${lotId}/bids`);
    const body = (await res.json()) as { data: Array<{ placedByUserId: string | null }> };

    expect(res.status).toBe(200);
    expect(body.data[0]?.placedByUserId).toBe(bidderId);
  });
});
