import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminEmailRoutes } from "./email.routes.js";
import { attachAdminPersonEmailDeliveryRoutes } from "./person-email-delivery.routes.js";

const SINCE = "2026-11-01T10:00:00.000Z";
const BODY = { reason: "mailbox_fixed", expectedSince: SINCE };

function createApp(staffRoles: StaffRoles | undefined) {
  const emailDelivery = {
    get: vi.fn().mockResolvedValue({ addressStatus: "ok", sends: [], block: null }),
    addressHash: vi.fn().mockResolvedValue("hash-1"),
  };
  const emailBlockLift = {
    lift: vi.fn().mockResolvedValue({ ok: true, provider: { status: "queued" } }),
  };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  const container = { admin: { emailDelivery, emailBlockLift, email: {} } } as never;
  attachAdminPersonEmailDeliveryRoutes(app as never, container);
  attachAdminEmailRoutes(app as never, container);
  return { app, emailDelivery, emailBlockLift };
}

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("GET /users/:userId/email-delivery", () => {
  it("tells the service what the viewer may lift", async () => {
    const { app, emailDelivery } = createApp(["client_services"]);
    const res = await app.request("http://test/users/u1/email-delivery");
    expect(res.status).toBe(200);
    expect(emailDelivery.get).toHaveBeenCalledWith("u1", {
      userId: "staff-1",
      canLift: true,
      isEmailAdmin: false,
    });
  });

  it("answers 404 for a person with no address", async () => {
    const { app, emailDelivery } = createApp(["administrator"]);
    emailDelivery.get.mockResolvedValue(null);
    expect((await app.request("http://test/users/u1/email-delivery")).status).toBe(404);
  });

  it("refuses roles without the read rule", async () => {
    const { app } = createApp(["finance"]);
    expect((await app.request("http://test/users/u1/email-delivery")).status).toBe(403);
  });
});

describe("POST /users/:userId/email-delivery/lift", () => {
  it("lifts for the person and reports the provider result", async () => {
    const { app, emailBlockLift } = createApp(["client_services"]);
    const res = await app.request("http://test/users/u1/email-delivery/lift", send("POST", BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { provider: { status: "queued" } } });
    expect(emailBlockLift.lift).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: "hash-1",
        userId: "u1",
        reason: "mailbox_fixed",
        actor: { userId: "staff-1", canLift: true, isEmailAdmin: false },
        expectedSince: new Date(SINCE),
      }),
    );
  });

  it("answers 409 with who lifted it and when", async () => {
    const { app, emailBlockLift } = createApp(["administrator"]);
    emailBlockLift.lift.mockResolvedValue({
      ok: false,
      error: "block_already_lifted",
      lifted: { at: new Date("2026-11-02T09:00:00Z"), byUserId: "s2", byName: "Sam Okoye" },
    });
    const res = await app.request("http://test/users/u1/email-delivery/lift", send("POST", BODY));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "block_already_lifted",
      liftedAt: "2026-11-02T09:00:00.000Z",
      liftedBy: { userId: "s2", name: "Sam Okoye" },
    });
  });

  it.each([
    ["unsubscribe_not_liftable", 422],
    ["administrator_only", 403],
    ["note_required", 422],
    ["written_request_required", 422],
  ] as const)("maps the refusal %s to %s", async (refusal, status) => {
    const { app, emailBlockLift } = createApp(["administrator"]);
    emailBlockLift.lift.mockResolvedValue({ ok: false, error: "refused", refusal });
    const res = await app.request("http://test/users/u1/email-delivery/lift", send("POST", BODY));
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: string }).error).toBe(refusal);
  });

  it("requires a reason and the block's start", async () => {
    const { app, emailBlockLift } = createApp(["administrator"]);
    const url = "http://test/users/u1/email-delivery/lift";
    expect((await app.request(url, send("POST", { expectedSince: SINCE }))).status).toBe(400);
    expect((await app.request(url, send("POST", { reason: "other" }))).status).toBe(400);
    expect(emailBlockLift.lift).not.toHaveBeenCalled();
  });

  it("answers 404 for a person with no address", async () => {
    const { app, emailDelivery } = createApp(["administrator"]);
    emailDelivery.addressHash.mockResolvedValue(null);
    const res = await app.request("http://test/users/u1/email-delivery/lift", send("POST", BODY));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /email/suppressions/:emailHash", () => {
  const url = `http://test/email/suppressions/${"a".repeat(64)}`;

  it("goes through the lift service and needs a reason", async () => {
    const { app, emailBlockLift } = createApp(["administrator"]);
    expect((await app.request(url, send("DELETE"))).status).toBe(400);
    const res = await app.request(url, send("DELETE", BODY));
    expect(res.status).toBe(200);
    expect(emailBlockLift.lift).toHaveBeenCalledWith(
      expect.objectContaining({ emailHash: "a".repeat(64), reason: "mailbox_fixed" }),
    );
  });

  it("stays with email administrators", async () => {
    const { app } = createApp(["client_services"]);
    expect((await app.request(url, send("DELETE", BODY))).status).toBe(403);
  });

  it("no longer offers a bulk lift", async () => {
    const { app } = createApp(["administrator"]);
    const res = await app.request(
      "http://test/email/suppressions/bulk",
      send("POST", { emailHashes: ["a".repeat(64)], op: "delete" }),
    );
    expect(res.status).toBe(404);
  });
});
