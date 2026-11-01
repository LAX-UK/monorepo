import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import { createSubmissionsLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { LotCardStateView } from "../services/interfaces/lot-viewer-state.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const ENTITY = "40000000-0000-4000-8000-0000000000a1";
const LOT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mount(opts: { signedIn?: boolean; role?: LegalEntityMemberRole | null } = {}) {
  const role = opts.role === undefined ? "owner" : opts.role;
  const states: LotCardStateView[] = [
    { lotId: LOT_A, position: "outbid", nextBidAmount: "7500.00" },
  ];
  const forLots = vi.fn(async () => states);
  const accounts = {
    findActiveMembership: vi.fn(async (userId: string, legalEntityId: string) =>
      role ? { userId, legalEntityId, role, isPrimaryAdmin: false } : null,
    ),
  };
  const userRoutes = createUserRouteServices(
    createTestUserRouteServicesInput({
      lotViewerState: { forLot: vi.fn(), forLots },
      requireBuyingAccount: createSubmissionsLegalEntityContext(accounts as never, {
        resolvePersonalEntity: vi.fn(),
      }),
    }),
  );
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(
        opts.signedIn === false
          ? null
          : { id: "user-1", role: "client", staffRole: null, scopes: ["bid.read"] },
      ),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, forLots };
}

const headers = { authorization: "Bearer test-lax-bid-api-token", "x-legal-entity-id": ENTITY };

describe("GET /users/me/lot-states", () => {
  it("requires sign-in", async () => {
    const { app } = mount({ signedIn: false });
    const res = await app.request(`http://t/users/me/lot-states?lotIds=${LOT_A}`);
    expect(res.status).toBe(401);
  });

  it("answers for the acting account with a short private cache", async () => {
    const { app, forLots } = mount({ role: "buyer_agent" });
    const res = await app.request(`http://t/users/me/lot-states?lotIds=${LOT_A},${LOT_B}`, {
      headers,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=15");
    expect(await res.json()).toEqual({
      data: [{ lotId: LOT_A, position: "outbid", nextBidAmount: "7500.00" }],
    });
    expect(forLots).toHaveBeenCalledWith({
      actor: { userId: "user-1", legalEntityId: ENTITY, memberRole: "buyer_agent" },
      lotIds: [LOT_A, LOT_B],
    });
  });

  it("ignores repeated ids", async () => {
    const { app, forLots } = mount();
    await app.request(`http://t/users/me/lot-states?lotIds=${LOT_A},${LOT_A}`, { headers });
    expect(forLots).toHaveBeenCalledWith(expect.objectContaining({ lotIds: [LOT_A] }));
  });

  it("takes at most 60 lots", async () => {
    const { app } = mount();
    const ids = Array.from(
      { length: 61 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    ).join(",");
    const res = await app.request(`http://t/users/me/lot-states?lotIds=${ids}`, { headers });
    expect(res.status).toBe(400);
  });

  it("rejects ids that are not uuids, and a missing list", async () => {
    const { app } = mount();
    expect(
      (await app.request("http://t/users/me/lot-states?lotIds=nope", { headers })).status,
    ).toBe(400);
    expect((await app.request("http://t/users/me/lot-states", { headers })).status).toBe(400);
  });

  it("refuses an account the person does not belong to", async () => {
    const { app, forLots } = mount({ role: null });
    const res = await app.request(`http://t/users/me/lot-states?lotIds=${LOT_A}`, { headers });
    expect(res.status).toBe(403);
    expect(forLots).not.toHaveBeenCalled();
  });
});
