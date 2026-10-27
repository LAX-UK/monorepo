import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLegalEntityRoutes } from "./legal-entities.js";

const GALLERY = "00000000-0000-4000-8000-000000000002";

function mount(
  rememberedAccount: {
    remember: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  },
  recordAccount: { accountFor: ReturnType<typeof vi.fn> } = { accountFor: vi.fn() },
) {
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    identityRoutes: { rememberedAccount, recordAccount },
  } as unknown as ContainerLegalEntityRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "user-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createLegalEntityRoutes(container, authenticator));
  return app;
}

function send(app: Hono, method: string, path: string, json: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
}

describe("remembered account routes", () => {
  it("saves the account the person switched to", async () => {
    const remember = vi.fn().mockResolvedValue({ ok: true });
    const app = mount({ remember, restore: vi.fn() });
    const res = await send(app, "PUT", "/legal-entities/me/remembered-account", {
      legalEntityId: GALLERY,
    });
    expect(res.status).toBe(200);
    expect(remember).toHaveBeenCalledWith("user-1", GALLERY);
  });

  it("refuses an account the person is not a member of", async () => {
    const remember = vi.fn().mockResolvedValue({ ok: false, reason: "not_a_member" });
    const app = mount({ remember, restore: vi.fn() });
    const res = await send(app, "PUT", "/legal-entities/me/remembered-account", {
      legalEntityId: GALLERY,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_a_member" });
  });

  it("rejects a malformed id before reaching the service", async () => {
    const remember = vi.fn();
    const app = mount({ remember, restore: vi.fn() });
    const res = await send(app, "PUT", "/legal-entities/me/remembered-account", {
      legalEntityId: "not-a-uuid",
    });
    expect(res.status).toBe(400);
    expect(remember).not.toHaveBeenCalled();
  });

  it("restores the account and passes the lost organisation through", async () => {
    const restored = {
      accountId: "personal-1",
      lostOrganisation: { id: GALLERY, displayName: "Northbank Gallery" },
    };
    const restore = vi.fn().mockResolvedValue(restored);
    const app = mount({ remember: vi.fn(), restore });
    const res = await send(app, "POST", "/legal-entities/me/remembered-account/restore", {
      candidateId: null,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: restored });
    expect(restore).toHaveBeenCalledWith("user-1", null);
  });

  it("answers 503 when the personal account cannot be found", async () => {
    const app = mount({ remember: vi.fn(), restore: vi.fn().mockResolvedValue(null) });
    const res = await send(app, "POST", "/legal-entities/me/remembered-account/restore", {
      candidateId: GALLERY,
    });
    expect(res.status).toBe(503);
  });
});

describe("record account route", () => {
  const unused = { remember: vi.fn(), restore: vi.fn() };

  it("names the account a consignment belongs to", async () => {
    const accountFor = vi.fn().mockResolvedValue({ kind: "ok", legalEntityId: GALLERY });
    const app = mount(unused, { accountFor });
    const res = await app.request(`/legal-entities/me/record-account/consignment/${GALLERY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { legalEntityId: GALLERY } });
    expect(accountFor).toHaveBeenCalledWith("user-1", "consignment", GALLERY);
  });

  it("answers 403 for a non-member and 404 for a missing record", async () => {
    const accountFor = vi
      .fn()
      .mockResolvedValueOnce({ kind: "no_access" })
      .mockResolvedValueOnce({ kind: "not_found" });
    const app = mount(unused, { accountFor });
    const path = `/legal-entities/me/record-account/purchase/${GALLERY}`;
    expect((await app.request(path)).status).toBe(403);
    expect((await app.request(path)).status).toBe(404);
  });

  it("rejects an unknown record kind", async () => {
    const accountFor = vi.fn();
    const app = mount(unused, { accountFor });
    const res = await app.request(`/legal-entities/me/record-account/invoice/${GALLERY}`);
    expect(res.status).toBe(400);
    expect(accountFor).not.toHaveBeenCalled();
  });
});
