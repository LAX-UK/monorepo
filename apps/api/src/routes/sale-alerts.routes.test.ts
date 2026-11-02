import { describe, expect, it, vi } from "vitest";
import type { ContainerSaleAlertRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createSaleAlertRoutes } from "./sale-alerts.js";

function mount(signedIn = true) {
  const service = {
    subscribe: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue("confirmed"),
    unsubscribePreview: vi.fn().mockResolvedValue({ email: "ada@example.com" }),
    unsubscribe: vi.fn().mockResolvedValue(true),
    settingsState: vi.fn().mockResolvedValue("on"),
    linkToClient: vi.fn().mockResolvedValue(true),
    stopForClient: vi.fn().mockResolvedValue(undefined),
  };
  const authenticator: IAuthenticator = {
    getSessionUser: async () =>
      signedIn
        ? ({ id: "u1", scopes: ["bid.read", "bid.write"], role: "buyer", staffRoles: [] } as never)
        : null,
  };
  const container = {
    visitorSaleAlertService: service,
    userSuspensionChecker: { isSuspended: async () => false },
  } as unknown as ContainerSaleAlertRoutesSlice;
  const app = createSaleAlertRoutes(container, authenticator);
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { app, service, post };
}

describe("POST /subscribe", () => {
  it("answers the same for every address, known or not", async () => {
    const { post } = mount(false);
    const first = await post("/subscribe", { email: "new@example.com" });
    const body = await first.json();
    expect(first.status).toBe(200);
    expect(body).toEqual({ ok: true });

    const second = await post("/subscribe", { email: "new@example.com" });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(body);
  });

  it("passes the normalised address and a default source to the service", async () => {
    const { post, service } = mount(false);
    await post("/subscribe", { email: "  Ada@Example.COM " });
    expect(service.subscribe).toHaveBeenCalledWith({
      email: "ada@example.com",
      source: "web_home_alerts",
    });
    await post("/subscribe", { email: "ada@example.com", source: "web_home_cover" });
    expect(service.subscribe).toHaveBeenLastCalledWith({
      email: "ada@example.com",
      source: "web_home_cover",
    });
  });

  it("rejects an invalid address or source without calling the service", async () => {
    const { post, service } = mount(false);
    expect((await post("/subscribe", { email: "nope" })).status).toBe(400);
    expect((await post("/subscribe", { email: "a@b.co", source: "Bad Source!" })).status).toBe(400);
    expect(service.subscribe).not.toHaveBeenCalled();
  });
});

describe("POST /confirm", () => {
  it("returns the outcome", async () => {
    const { post, service } = mount(false);
    service.confirm.mockResolvedValueOnce("expired");
    const res = await post("/confirm", { token: "abc" });
    expect(await res.json()).toEqual({ ok: true, outcome: "expired" });
    expect((await post("/confirm", {})).status).toBe(400);
  });
});

describe("unsubscribe", () => {
  it("accepts a mail client's one-click POST with the token in the query", async () => {
    const { app, service } = mount(false);
    const res = await app.request("/unsubscribe?t=tok", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(res.status).toBe(200);
    expect(service.unsubscribe).toHaveBeenCalledWith("tok");
  });

  it("rejects a link that is not genuine, on preview and on unsubscribe", async () => {
    const { app, service } = mount(false);
    service.unsubscribe.mockResolvedValue(false);
    service.unsubscribePreview.mockResolvedValue(null);
    expect((await app.request("/unsubscribe?t=bad", { method: "POST" })).status).toBe(400);
    expect((await app.request("/unsubscribe", { method: "POST" })).status).toBe(400);
    expect((await app.request("/unsubscribe/preview?t=bad")).status).toBe(400);
  });

  it("previews the address", async () => {
    const { app } = mount(false);
    const res = await app.request("/unsubscribe/preview?t=tok");
    expect(await res.json()).toEqual({ ok: true, data: { email: "ada@example.com" } });
  });
});

describe("the signed-in client's view", () => {
  it("needs a session", async () => {
    const { app, service } = mount(false);
    expect((await app.request("/me")).status).toBe(401);
    expect((await app.request("/me/link", { method: "POST" })).status).toBe(401);
    expect((await app.request("/me", { method: "DELETE" })).status).toBe(401);
    expect(service.settingsState).not.toHaveBeenCalled();
  });

  it("reads, links and turns off the client's own sign-up only", async () => {
    const { app, service } = mount(true);
    expect(await (await app.request("/me")).json()).toEqual({ data: { state: "on" } });
    expect((await app.request("/me/link", { method: "POST" })).status).toBe(200);
    expect(service.linkToClient).toHaveBeenCalledWith("u1");
    expect((await app.request("/me", { method: "DELETE" })).status).toBe(204);
    expect(service.stopForClient).toHaveBeenCalledWith("u1");
  });

  it("answers 409 when there is nothing to link", async () => {
    const { app, service } = mount(true);
    service.linkToClient.mockResolvedValueOnce(false);
    expect((await app.request("/me/link", { method: "POST" })).status).toBe(409);
  });
});
