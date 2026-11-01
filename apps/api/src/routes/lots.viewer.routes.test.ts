import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { BiddingLotBidHistoryHttpApplicationService } from "../services/bidding/bidding-lot-bid-history-http-application.service.js";
import { BiddingLotViewerHttpApplicationService } from "../services/bidding/bidding-lot-viewer-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type {
  ILotViewerStateService,
  LotViewerView,
} from "../services/interfaces/lot-viewer-state.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubBiddingRouteServices } from "../testing/stub-bidding-route-services.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createLotRoutes } from "./lots.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const VIEW: LotViewerView = {
  lotId,
  registration: "approved",
  registrationRequired: true,
  position: "leading",
  myHighestBid: "7000.00",
  myMaxBid: "9000.00",
  purchase: null,
  agentLimitLeft: "1500.00",
};

function mount(opts: {
  signedIn: boolean;
  role?: LegalEntityMemberRole;
  viewerState?: Partial<ILotViewerStateService>;
  lotService?: Record<string, unknown>;
}) {
  const forLot = vi.fn().mockResolvedValue(VIEW);
  const viewerState: ILotViewerStateService = {
    forLot,
    forLots: vi.fn(),
    ...opts.viewerState,
  };
  const lotService = {
    listPublicBidHistory: vi.fn(),
    listBidsForPublicApi: vi.fn(),
    ...opts.lotService,
  };
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    catalogRoutes: stubCatalogRouteServices(),
    kycService: null,
    redis: null,
    requireSubmissionsLegalEntityContext: createMiddleware(async (c, next) => {
      c.set("legalEntityContext", {
        legalEntityId: ENTITY,
        userId: c.get("userId") as string,
        role: opts.role ?? "owner",
        isPrimaryAdmin: true,
      });
      await next();
    }),
    bidding: stubBiddingRouteServices({
      lotViewerHttp: new BiddingLotViewerHttpApplicationService(viewerState),
      lotBidHistoryHttp: new BiddingLotBidHistoryHttpApplicationService(lotService as never),
    }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(
        opts.signedIn
          ? { id: "user-1", role: "client", staffRoles: undefined, scopes: ["bid.read"] }
          : null,
      ),
  };
  const app = new Hono();
  app.route("/lots", createLotRoutes(container, authenticator, passThroughAccountOnboarding));
  return { app, forLot, lotService };
}

const auth = { authorization: "Bearer test-lax-bid-api-token" };

describe("GET /lots/:id/me", () => {
  it("requires sign-in", async () => {
    const { app, forLot } = mount({ signedIn: false });
    const res = await app.request(`http://t/lots/${lotId}/me`);
    expect(res.status).toBe(401);
    expect(forLot).not.toHaveBeenCalled();
  });

  it("answers for the acting account and is never cached", async () => {
    const { app, forLot } = mount({ signedIn: true, role: "buyer_agent" });
    const res = await app.request(`http://t/lots/${lotId}/me`, { headers: auth });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ data: VIEW });
    expect(forLot).toHaveBeenCalledWith({
      actor: { userId: "user-1", legalEntityId: ENTITY, memberRole: "buyer_agent" },
      lotId,
    });
  });

  it("is a 404 for a lot that does not exist", async () => {
    const { app } = mount({
      signedIn: true,
      viewerState: { forLot: vi.fn().mockResolvedValue(null) },
    });
    const res = await app.request(`http://t/lots/${lotId}/me`, { headers: auth });
    expect(res.status).toBe(404);
  });

  it("rejects a lot id that is not a uuid", async () => {
    const { app } = mount({ signedIn: true });
    const res = await app.request("http://t/lots/not-a-lot/me", { headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("GET /lots/:id/bid-history", () => {
  const history = {
    entries: [
      { amount: "7000.00", channel: "room", placedAt: "2026-11-03T20:00:00.000Z", isViewer: false },
    ],
    total: 6,
  };

  it("is public, and marks the viewer's own bids only when signed in", async () => {
    const listPublicBidHistory = vi.fn().mockResolvedValue({ kind: "ok", data: history });
    const { app } = mount({ signedIn: false, lotService: { listPublicBidHistory } });
    const res = await app.request(`http://t/lots/${lotId}/bid-history?limit=3`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: history });
    expect(listPublicBidHistory).toHaveBeenCalledWith({
      lotId,
      viewerId: undefined,
      limitQuery: "3",
    });
  });

  it("passes the signed-in viewer so their rows read as theirs", async () => {
    const listPublicBidHistory = vi.fn().mockResolvedValue({ kind: "ok", data: history });
    const { app } = mount({ signedIn: true, lotService: { listPublicBidHistory } });
    await app.request(`http://t/lots/${lotId}/bid-history`, { headers: auth });
    expect(listPublicBidHistory).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: "user-1" }),
    );
  });

  it("is a 404 for a lot that does not exist", async () => {
    const { app } = mount({
      signedIn: false,
      lotService: { listPublicBidHistory: vi.fn().mockResolvedValue({ kind: "not_found" }) },
    });
    const res = await app.request(`http://t/lots/${lotId}/bid-history`);
    expect(res.status).toBe(404);
  });

  it("never carries a bidder, paddle or account field", async () => {
    const listPublicBidHistory = vi.fn().mockResolvedValue({ kind: "ok", data: history });
    const { app } = mount({ signedIn: false, lotService: { listPublicBidHistory } });
    const body = JSON.stringify(
      await (await app.request(`http://t/lots/${lotId}/bid-history`)).json(),
    );
    expect(body).not.toMatch(/bidder|paddle|placedByUserId|legalEntity/i);
  });
});
