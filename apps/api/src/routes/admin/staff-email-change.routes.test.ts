import { type StaffRoles, normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminStaffEmailChangeRoutes } from "./staff-email-change.routes.js";

const TARGET_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const ACTOR_ID = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";
const BODY = {
  newEmail: "New@Example.com",
  reason: "Lost the old mailbox; caller matched the KYC record.",
  proof: { kind: "id_check", reference: "IDV-2291" },
};

function setup(session: { role: string; staffRoles: StaffRoles | undefined }, recent = true) {
  const ok = (value: unknown) => ({
    match: (onOk: (v: unknown) => unknown) => onOk(value),
  });
  const change = vi.fn().mockResolvedValue(ok({ pendingEmail: "new@example.com" }));
  const kycRecord = vi.fn().mockResolvedValue(ok(null));
  const cancel = vi.fn().mockResolvedValue(ok({ cancelled: true }));
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    c.set("userId", ACTOR_ID);
    c.set("userRole", session.role);
    c.set("userStaffRoles", session.staffRoles);
    c.set("identitySessionId", "session-1");
    await next();
  });
  attachAdminStaffEmailChangeRoutes(
    platform,
    { change, cancel, kycRecord },
    createTestStaffGuards({ recent }),
  );
  const app = new Hono();
  app.route("/admin", platform);
  const post = (body: unknown) =>
    app.request(`http://test/admin/users/${TARGET_ID}/email-change`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const postCancel = (body: unknown) =>
    app.request(`http://test/admin/users/${TARGET_ID}/email-change/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const get = () => app.request(`http://test/admin/users/${TARGET_ID}/email-change/kyc-record`);
  return { post, postCancel, get, change, cancel, kycRecord };
}

describe("POST /admin/users/:userId/email-change", () => {
  it.each([["administrator"], ["client_services"]])(
    "lets %s start the change and passes the actor, target and normalised body on",
    async (role) => {
      const staffRoles = normalizeStaffRoles([role]);
      const { post, change } = setup({ role: "staff", staffRoles });
      const res = await post(BODY);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, pendingEmail: "new@example.com" });
      expect(change).toHaveBeenCalledWith(
        { userId: ACTOR_ID, role: "staff", staffRoles },
        TARGET_ID,
        { ...BODY, newEmail: "new@example.com" },
      );
    },
  );

  it.each([["fulfilment"], ["finance"], ["read_only"], ["compliance"], ["specialist"]])(
    "refuses %s",
    async (role) => {
      const { post, change } = setup({ role: "staff", staffRoles: normalizeStaffRoles([role]) });
      expect((await post(BODY)).status).toBe(403);
      expect(change).not.toHaveBeenCalled();
    },
  );

  it("refuses a customer", async () => {
    const { post, change } = setup({ role: "client", staffRoles: [] });
    expect((await post(BODY)).status).toBe(403);
    expect(change).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", { ...BODY, reason: undefined }],
    ["a one-word reason", { ...BODY, reason: "lost" }],
    ["no proof", { ...BODY, proof: undefined }],
    ["a proof of an unknown kind", { ...BODY, proof: { kind: "phone_call" } }],
    ["an ID check with no reference", { ...BODY, proof: { kind: "id_check", reference: " " } }],
    ["a KYC match with no record", { ...BODY, proof: { kind: "kyc_match" } }],
    ["an address that is not one", { ...BODY, newEmail: "not-an-address" }],
  ])("rejects %s", async (_label, body) => {
    const { post, change } = setup({ role: "staff", staffRoles: ["administrator"] });
    expect((await post(body)).status).toBe(400);
    expect(change).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in first, and changes nothing", async () => {
    const { post, change } = setup({ role: "staff", staffRoles: ["administrator"] }, false);
    const res = await post(BODY);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Recent sign-in required",
      code: "step_up_required",
    });
    expect(change).not.toHaveBeenCalled();
  });

  it("answers a person without the capability with forbidden, not a sign-in prompt", async () => {
    const { post } = setup({ role: "staff", staffRoles: ["finance"] }, false);
    const res = await post(BODY);
    expect(res.status).toBe(403);
    expect((await res.json()) as { code?: string }).not.toMatchObject({ code: "step_up_required" });
  });

  it("passes a refusal on with its status and message", async () => {
    const { post, change } = setup({ role: "staff", staffRoles: ["administrator"] });
    change.mockResolvedValueOnce({
      match: (_ok: unknown, onErr: (e: unknown) => unknown) =>
        onErr({ status: 409, message: "Another account already uses that address." }),
    });
    const res = await post(BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Another account already uses that address." });
  });
});

describe("GET /admin/users/:userId/email-change/kyc-record", () => {
  it("shows the record to client services, never cached", async () => {
    const { get, kycRecord } = setup({ role: "staff", staffRoles: ["client_services"] });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: null });
    expect(kycRecord).toHaveBeenCalledWith(
      { userId: ACTOR_ID, role: "staff", staffRoles: ["client_services"] },
      TARGET_ID,
    );
  });

  it("refuses roles that may not change an email", async () => {
    const { get, kycRecord } = setup({ role: "staff", staffRoles: ["fulfilment"] });
    expect((await get()).status).toBe(403);
    expect(kycRecord).not.toHaveBeenCalled();
  });
});

describe("POST /admin/users/:userId/email-change/cancel", () => {
  const CANCEL_BODY = { reason: "Caller found the old mailbox again." };

  it.each([["administrator"], ["client_services"]])(
    "lets %s withdraw the change and passes the actor, target and reason on",
    async (role) => {
      const staffRoles = normalizeStaffRoles([role]);
      const { postCancel, cancel } = setup({ role: "staff", staffRoles });
      const res = await postCancel(CANCEL_BODY);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(cancel).toHaveBeenCalledWith(
        { userId: ACTOR_ID, role: "staff", staffRoles },
        TARGET_ID,
        CANCEL_BODY,
      );
    },
  );

  it.each([["fulfilment"], ["finance"], ["read_only"], ["compliance"], ["specialist"]])(
    "refuses %s",
    async (role) => {
      const { postCancel, cancel } = setup({
        role: "staff",
        staffRoles: normalizeStaffRoles([role]),
      });
      expect((await postCancel(CANCEL_BODY)).status).toBe(403);
      expect(cancel).not.toHaveBeenCalled();
    },
  );

  it("refuses a customer", async () => {
    const { postCancel, cancel } = setup({ role: "client", staffRoles: [] });
    expect((await postCancel(CANCEL_BODY)).status).toBe(403);
    expect(cancel).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", {}],
    ["a one-word reason", { reason: "oops" }],
  ])("rejects %s", async (_label, body) => {
    const { postCancel, cancel } = setup({ role: "staff", staffRoles: ["administrator"] });
    expect((await postCancel(body)).status).toBe(400);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in first, and cancels nothing", async () => {
    const { postCancel, cancel } = setup({ role: "staff", staffRoles: ["administrator"] }, false);
    const res = await postCancel(CANCEL_BODY);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Recent sign-in required",
      code: "step_up_required",
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("passes a refusal on with its status and message", async () => {
    const { postCancel, cancel } = setup({ role: "staff", staffRoles: ["administrator"] });
    cancel.mockResolvedValueOnce({
      match: (_ok: unknown, onErr: (e: unknown) => unknown) =>
        onErr({ status: 409, message: "No email change is waiting for this person." }),
    });
    const res = await postCancel(CANCEL_BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "No email change is waiting for this person." });
  });
});
