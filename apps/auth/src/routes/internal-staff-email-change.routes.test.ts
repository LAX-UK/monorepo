import { describe, expect, it, vi } from "vitest";
import type { IIdentityLifecycleService } from "../services/identity-lifecycle.service.js";
import { createInternalIdentityRoutes } from "./internal-identity.routes.js";

const LIFECYCLE = { id: "api-service", secret: "machine-secret-at-least-32-characters" }; // gitleaks:allow
const STAFF = { id: "staff-email-change", secret: "staff-email-secret-at-least-32-chars" }; // gitleaks:allow
const SUBJECT = "11111111-1111-4111-8111-111111111111";

const BODY = {
  newEmail: "new@example.com",
  actorSubjectId: "staff-1",
  reason: "Lost the old mailbox; caller matched the KYC record.",
  proof: { kind: "kyc_match", kycSessionId: "kyc-1" },
};

function setup(withScope = true) {
  const store = new Map<string, string>();
  const start = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    ok: true,
    pendingEmail: "new@example.com",
  }));
  const redis = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
    del: async (key: string) => {
      store.delete(key);
    },
    incr: async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    },
    expire: async () => 1,
    ttl: async () => 60,
  };
  const onFailure = vi.fn();
  const app = createInternalIdentityRoutes({
    lifecycle: {
      disable: vi.fn(),
      enable: vi.fn(),
      merge: vi.fn(),
    } satisfies IIdentityLifecycleService,
    operations: {} as never,
    emailChange: {} as never,
    accountDeletion: {} as never,
    redis,
    machineClientId: LIFECYCLE.id,
    machineClientSecret: LIFECYCLE.secret,
    ...(withScope
      ? {
          staffEmailChange: {
            changes: { start } as never,
            redis,
            clientId: STAFF.id,
            clientSecret: STAFF.secret,
            onFailure,
          },
        }
      : {}),
  });
  return { app, start, onFailure };
}

async function token(
  app: ReturnType<typeof setup>["app"],
  credential: { id: string; secret: string },
  scope: string,
): Promise<Response> {
  const basic = Buffer.from(`${credential.id}:${credential.secret}`, "utf8").toString("base64");
  return app.request("/oauth/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&scope=${scope}`,
  });
}

async function accessToken(
  app: ReturnType<typeof setup>["app"],
  who = STAFF,
  scope = "staff_email_change",
) {
  const response = await token(app, who, scope);
  expect(response.status).toBe(200);
  return ((await response.json()) as { access_token: string }).access_token;
}

function post(app: ReturnType<typeof setup>["app"], bearer: string | null, body: unknown = BODY) {
  return app.request(`/identity/subjects/${SUBJECT}/staff-email-change`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("staff email change machine route", () => {
  it("refuses a request with no token", async () => {
    const { app, start } = setup();
    expect((await post(app, null)).status).toBe(401);
    expect(start).not.toHaveBeenCalled();
  });

  it("refuses a lifecycle token: the scope is its own", async () => {
    const { app, start } = setup();
    const lifecycleToken = await accessToken(app, { ...LIFECYCLE }, "identity.lifecycle");
    expect((await post(app, lifecycleToken)).status).toBe(401);
    expect(start).not.toHaveBeenCalled();
  });

  it("does not let the staff credential into the lifecycle routes", async () => {
    const { app } = setup();
    const staffToken = await accessToken(app);
    const response = await app.request(`/identity/subjects/${SUBJECT}/disable`, {
      method: "POST",
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(response.status).toBe(401);
  });

  it("refuses the staff credential asking for the lifecycle scope", async () => {
    const { app } = setup();
    expect((await token(app, STAFF, "identity.lifecycle")).status).toBe(401);
  });

  it("does not offer the scope when no credential is configured", async () => {
    const { app } = setup(false);
    expect((await token(app, STAFF, "staff_email_change")).status).toBe(401);
  });

  it("starts the change for a valid token and request", async () => {
    const { app, start } = setup();
    const response = await post(app, await accessToken(app));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ pendingEmail: "new@example.com" });
    expect(start).toHaveBeenCalledWith(SUBJECT, BODY);
  });

  it("rejects a request without a reason or proof", async () => {
    const { app, start } = setup();
    const bearer = await accessToken(app);
    expect((await post(app, bearer, { ...BODY, reason: "no" })).status).toBe(400);
    expect((await post(app, bearer, { ...BODY, proof: undefined })).status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });

  it.each([
    ["subject_not_found", 404],
    ["same_email", 409],
    ["email_taken", 409],
    ["channel_unavailable", 503],
  ])("answers %s with %i", async (kind, status) => {
    const { app, start } = setup();
    start.mockResolvedValueOnce({ ok: false, kind });
    const response = await post(app, await accessToken(app));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });

  it("reports an unexpected failure without leaking it", async () => {
    const { app, start, onFailure } = setup();
    start.mockRejectedValueOnce(new Error("db exploded"));
    const response = await post(app, await accessToken(app));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
    expect(onFailure).toHaveBeenCalled();
  });
});
