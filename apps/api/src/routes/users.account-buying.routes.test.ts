import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import {
  X_LEGAL_ENTITY_ID_HEADER,
  createSubmissionsLegalEntityContext,
} from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const ORG = "40000000-0000-4000-8000-0000000000a1";
const ME = "user-1";

/** The account-scoped buying reads, mounted with the real account middleware over fake data. */
function mount(role: LegalEntityMemberRole | null) {
  const listBidsForBuyerAccount = vi.fn(async () => []);
  const lotList = vi.fn(async () => []);
  const listEntityPaymentsForBuyerApi = vi.fn(async () => ({ data: [] }));
  const accounts = {
    findActiveMembership: vi.fn(async (userId: string, legalEntityId: string) =>
      role ? { userId, legalEntityId, role, isPrimaryAdmin: false } : null,
    ),
  };
  const requireBuyingAccount = createSubmissionsLegalEntityContext(accounts as never, {
    resolvePersonalEntity: vi.fn(),
  });
  const userRoutes = createUserRouteServices(
    createTestUserRouteServicesInput({
      userDashboardReadService: {
        listBidsForUser: vi.fn(),
        listWatchlistForUser: vi.fn(),
        listBidsForBuyerAccount,
      } as never,
      lotService: { list: lotList, getById: vi.fn() } as never,
      paymentBuyerService: {
        listMyPaymentsForBuyerApi: vi.fn(),
        listEntityPaymentsForBuyerApi,
      } as never,
      mediaUrlResolver: { resolveManyUnique: vi.fn(async () => new Map()) } as never,
      requireBuyingAccount,
    }),
  );
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: ME,
      role: "client",
      staffRole: null,
      scopes: ["bid.read"],
    }),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  const get = (path: string) =>
    app.request(`/users/me/account/${path}`, { headers: { [X_LEGAL_ENTITY_ID_HEADER]: ORG } });
  return { get, listBidsForBuyerAccount, lotList, listEntityPaymentsForBuyerApi };
}

describe("GET /users/me/account/bids", () => {
  it.each([
    ["owner", null],
    ["admin", null],
    ["buyer_agent", ME],
  ] as const)("gives %s the account's bids they follow", async (role, bidder) => {
    const { get, listBidsForBuyerAccount } = mount(role);
    const res = await get("bids");
    expect(res.status).toBe(200);
    expect(listBidsForBuyerAccount).toHaveBeenCalledWith(ORG, bidder, undefined);
  });

  it.each(["finance", "consignor", "viewer"] as const)("refuses %s", async (role) => {
    const { get, listBidsForBuyerAccount } = mount(role);
    const res = await get("bids");
    expect(res.status).toBe(403);
    expect(listBidsForBuyerAccount).not.toHaveBeenCalled();
  });

  it("refuses someone who is not (or no longer) a member", async () => {
    const { get, listBidsForBuyerAccount } = mount(null);
    expect((await get("bids")).status).toBe(403);
    expect(listBidsForBuyerAccount).not.toHaveBeenCalled();
  });
});

describe("GET /users/me/account/purchases", () => {
  it.each(["owner", "admin", "finance"] as const)(
    "gives %s every lot won for the account",
    async (role) => {
      const { get, lotList, listEntityPaymentsForBuyerApi } = mount(role);
      const res = await get("purchases");
      expect(res.status).toBe(200);
      expect(lotList).toHaveBeenCalledWith(
        expect.not.objectContaining({ winnerId: expect.anything() }),
      );
      expect(lotList).toHaveBeenCalledWith(
        expect.objectContaining({ buyerLegalEntityId: ORG, statuses: ["ended"] }),
      );
      expect(listEntityPaymentsForBuyerApi).toHaveBeenCalledWith(ORG, {});
    },
  );

  it("gives a buyer agent the lots they won for the account", async () => {
    const { get, lotList } = mount("buyer_agent");
    expect((await get("purchases")).status).toBe(200);
    expect(lotList).toHaveBeenCalledWith(
      expect.objectContaining({ buyerLegalEntityId: ORG, winnerId: ME }),
    );
  });

  it.each(["consignor", "viewer"] as const)("refuses %s", async (role) => {
    const { get, lotList } = mount(role);
    expect((await get("purchases")).status).toBe(403);
    expect(lotList).not.toHaveBeenCalled();
  });

  it("refuses a removed member", async () => {
    const { get, lotList } = mount(null);
    expect((await get("purchases")).status).toBe(403);
    expect(lotList).not.toHaveBeenCalled();
  });
});
