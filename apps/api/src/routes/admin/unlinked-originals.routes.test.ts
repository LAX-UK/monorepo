import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import { stubStepUpGuard } from "../../testing/staff-mutation-guards.js";
import { createAdminRoutes } from "../admin.js";

const VIEW = {
  blockPublishing: false,
  counts: { bid: 1, laxArt: 0 },
  items: [{ product: "bid", id: "lot-1", title: "Harbour", artistName: null, state: "Live" }],
};

function buildApp(staffRole: string) {
  const unlinkedOriginals = {
    view: vi.fn().mockResolvedValue(VIEW),
    setBlockPublishing: vi.fn().mockResolvedValue({ blockPublishing: true }),
  };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      stepUp: stubStepUpGuard(true),
      inventoryMoves: { unlinkedOriginals },
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_admin",
      identitySessionId: "session-1",
      role: "staff",
      staffRoles: normalizeStaffRoles([staffRole]),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, unlinkedOriginals };
}

const put = (app: Hono, blockPublishing: unknown) =>
  app.request("http://test/admin/inventory/unlinked-originals/block-publishing", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockPublishing }),
  });

describe("admin unlinked originals routes", () => {
  it("lets an administrator read the report and turn the switch on", async () => {
    const { app, unlinkedOriginals } = buildApp("administrator");

    const read = await app.request("http://test/admin/inventory/unlinked-originals");
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("no-store");
    expect(((await read.json()) as { data: unknown }).data).toEqual(VIEW);

    const write = await put(app, true);
    expect(write.status).toBe(200);
    expect(unlinkedOriginals.setBlockPublishing).toHaveBeenCalledWith(true, "usr_admin");
  });

  it("rejects a body that is not a yes or no", async () => {
    const { app, unlinkedOriginals } = buildApp("administrator");
    expect((await put(app, "yes")).status).toBe(400);
    expect(unlinkedOriginals.setBlockPublishing).not.toHaveBeenCalled();
  });

  it("lets staff who manage the catalogue read the report but not change the switch", async () => {
    const { app, unlinkedOriginals } = buildApp("cataloguer");
    expect((await app.request("http://test/admin/inventory/unlinked-originals")).status).toBe(200);
    expect((await put(app, true)).status).toBe(403);
    expect(unlinkedOriginals.setBlockPublishing).not.toHaveBeenCalled();
  });

  it("keeps the report from staff with no lot access", async () => {
    const { app, unlinkedOriginals } = buildApp("finance");
    expect((await app.request("http://test/admin/inventory/unlinked-originals")).status).toBe(403);
    expect(unlinkedOriginals.view).not.toHaveBeenCalled();
  });
});
