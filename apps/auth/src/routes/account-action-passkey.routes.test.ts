import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
  createAccountActionPasskeyRoutes,
} from "./account-action-passkey.routes.js";

const ISSUER = "https://auth.test";
const ACCOUNT = "https://account.test";

const CAPABILITIES = {
  googleEnabled: false,
  appleEnabled: false,
  phoneEnabled: false,
  turnstileSiteKey: null,
  shopOrigin: "https://shop.test",
  artOrigin: "https://art.test",
  shopAdminOrigin: "https://shop-admin.test",
  bidOrigin: "https://bid.test",
  accountOrigin: ACCOUNT,
  passkeysEnabled: true,
  emailFirst: true,
  requireEmailVerification: true,
};

function setup(
  overrides: {
    session?: { session: { id: string }; user: { id: string } } | null;
    holds?: boolean;
    wait?: number | null;
    rename?: { ok: true } | { ok: false; kind: "not_linked" | "invalid_name" };
    sessionFails?: boolean;
    created?: string | null;
  } = {},
) {
  const grants = {
    holds: vi.fn(async () => overrides.holds ?? true),
    // The passkey this enrolment just made; `null` models an enrolment that made none.
    createdPasskey: vi.fn(async () =>
      overrides.created === undefined ? "pk-1" : overrides.created,
    ),
  };
  const methods = {
    renamePasskey: vi.fn(
      async () => overrides.rename ?? { ok: true as const, passkey: {} as never },
    ),
  };
  const onFailure = vi.fn();
  const app = createAccountActionPasskeyRoutes({
    capabilities: CAPABILITIES,
    getSession: async () => {
      if (overrides.sessionFails) throw new Error("down");
      return overrides.session === undefined
        ? { session: { id: "sid-1" }, user: { id: "u1" } }
        : overrides.session;
    },
    grants,
    methods: methods as never,
    issuerOrigin: ISSUER,
    accountOrigin: ACCOUNT,
    rateLimit: async () => overrides.wait ?? null,
    clientKey: () => "203.0.113.7",
    onFailure,
  });
  return { app, grants, methods, onFailure };
}

describe("GET /account-action/passkey", () => {
  it("shows the add page to the browser that holds the permission, and sends nothing on", async () => {
    const { app, grants } = setup();
    const response = await app.request("/account-action/passkey");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Create a passkey");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(grants.holds).toHaveBeenCalledWith("sid-1", "u1");
    expect(html).toContain(`href="${ACCOUNT}/account/security"`);
    expect(html).toContain(`${ACCOUNT}/account/security?signInMethod=passkey_added`);
  });

  it.each([
    ["no sign-in", { session: null }],
    ["no permission", { holds: false }],
    ["a session that cannot be read", { sessionFails: true }],
  ])(
    "shows the same expired page for %s, so it says nothing about the account",
    async (_label, overrides) => {
      const { app } = setup(overrides);
      const response = await app.request("/account-action/passkey");
      const html = await response.text();
      expect(response.status).toBe(403);
      expect(html).toContain("This link has expired");
      expect(html).not.toContain("Create a passkey");
    },
  );

  it("records an unreadable session or permission for the logs", async () => {
    const { app, onFailure } = setup({ sessionFails: true });
    await app.request("/account-action/passkey");
    expect(onFailure).toHaveBeenCalled();
  });

  it("answers 429 with the expired page when the caller is over its budget", async () => {
    const { app, grants } = setup({ wait: 30 });
    const response = await app.request("/account-action/passkey");
    expect(response.status).toBe(429);
    expect(grants.holds).not.toHaveBeenCalled();
  });
});

describe(`POST ${ACCOUNT_ACTION_PASSKEY_RENAME_PATH}`, () => {
  const post = (body: unknown, headers: Record<string, string> = {}) => ({
    method: "POST",
    headers: { origin: ISSUER, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  it("renames the signed-in person's own passkey", async () => {
    const { app, methods } = setup();
    const response = await app.request(
      ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
      post({ passkeyId: "pk-1", name: "Work laptop" }),
    );
    expect(response.status).toBe(200);
    expect(methods.renamePasskey).toHaveBeenCalledWith("u1", "pk-1", "Work laptop");
  });

  it("refuses a request from any other origin or none, before reading the session", async () => {
    const { app, methods } = setup();
    for (const origin of ["https://evil.test", ""]) {
      const response = await app.request(
        ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
        post({ passkeyId: "pk-1", name: "x" }, { origin }),
      );
      expect(response.status).toBe(403);
    }
    expect(methods.renamePasskey).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const { app } = setup();
    const response = await app.request(ACCOUNT_ACTION_PASSKEY_RENAME_PATH, {
      method: "POST",
      headers: { origin: ISSUER, "content-type": "text/plain" },
      body: "{}",
    });
    expect(response.status).toBe(415);
  });

  it.each([
    [{}],
    [{ passkeyId: 1, name: "x" }],
    [{ passkeyId: "pk-1", name: "" }],
    [{ passkeyId: "pk-1", name: "a".repeat(41) }],
    [{ passkeyId: "pk-1", name: "a\nb" }],
  ])("refuses %j as an invalid request", async (body) => {
    const { app, methods } = setup();
    const response = await app.request(ACCOUNT_ACTION_PASSKEY_RENAME_PATH, post(body));
    expect(response.status).toBe(400);
    expect(methods.renamePasskey).not.toHaveBeenCalled();
  });

  it("renames only the passkey this enrolment just made, 404 for any other", async () => {
    const { app, methods, grants } = setup();
    const response = await app.request(
      ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
      post({ passkeyId: "an-older-passkey", name: "Mine" }),
    );
    expect(response.status).toBe(404);
    expect(grants.createdPasskey).toHaveBeenCalledWith("sid-1", "u1");
    expect(methods.renamePasskey).not.toHaveBeenCalled();
    const none = setup({ created: null });
    expect(
      (
        await none.app.request(
          ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
          post({ passkeyId: "pk-1", name: "Mine" }),
        )
      ).status,
    ).toBe(404);
  });

  it("refuses a browser with no session", async () => {
    const { app, methods } = setup({ session: null });
    const response = await app.request(
      ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
      post({ passkeyId: "pk-1", name: "Work laptop" }),
    );
    expect(response.status).toBe(401);
    expect(methods.renamePasskey).not.toHaveBeenCalled();
  });

  it("answers not found for a passkey that is not the person's, the same as one that does not exist", async () => {
    const { app } = setup({ rename: { ok: false, kind: "not_linked" } });
    const response = await app.request(
      ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
      post({ passkeyId: "pk-of-someone-else", name: "Mine now" }),
    );
    expect(response.status).toBe(404);
  });

  it("answers 429 when over budget, and 503 when the store fails", async () => {
    const limited = setup({ wait: 30 });
    expect(
      (
        await limited.app.request(
          ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
          post({ passkeyId: "pk-1", name: "x" }),
        )
      ).status,
    ).toBe(429);
    const failing = setup();
    failing.methods.renamePasskey.mockRejectedValueOnce(new Error("db down"));
    const response = await failing.app.request(
      ACCOUNT_ACTION_PASSKEY_RENAME_PATH,
      post({ passkeyId: "pk-1", name: "Work laptop" }),
    );
    expect(response.status).toBe(503);
    expect(failing.onFailure).toHaveBeenCalled();
  });
});
