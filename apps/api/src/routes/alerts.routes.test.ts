import { describe, expect, it, vi } from "vitest";
import type { ContainerAlertRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminSaleAnnounceRoutes } from "./admin-sale-announce.js";
import { createAlertRoutes } from "./alerts.js";
import { createLegacySaleAlertRoutes } from "./sale-alerts-legacy.js";

function engine() {
  return {
    subscribe: { requestAsVisitor: vi.fn().mockResolvedValue(undefined) },
    confirm: {
      preview: vi.fn().mockResolvedValue({ state: "ready", maskedEmail: "a•••@example.com" }),
      confirm: vi.fn().mockResolvedValue("confirmed"),
    },
    stop: {
      preview: vi.fn().mockResolvedValue({
        state: "ready",
        maskedEmail: "a•••@example.com",
        topics: ["bid.new_sales"],
        fromTopic: null,
      }),
      stop: vi.fn().mockResolvedValue("stopped"),
      stopOneClick: vi.fn().mockResolvedValue("stopped"),
    },
    preferences: {
      view: vi.fn().mockResolvedValue({ state: "confirmed", linked: true, topics: [] }),
      setTopic: vi.fn().mockResolvedValue("saved"),
    },
    saleReader: { countEmailSubscribers: vi.fn().mockResolvedValue(1284) },
    legacyUntil: new Date("2027-02-15T00:00:00Z"),
  };
}

function container(e = engine()) {
  return {
    alertEngine: e,
    userSuspensionChecker: { isSuspended: async () => false },
  } as unknown as ContainerAlertRoutesSlice;
}

function authenticator(user: { role: string; staffRoles?: unknown } | null): IAuthenticator {
  return {
    getSessionUser: async () =>
      user
        ? ({ id: "u1", scopes: ["bid.read", "bid.write"], staffRoles: [], ...user } as never)
        : null,
  };
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("public alert routes", () => {
  it("answers a sign-up the same for every address and passes the normalised one on", async () => {
    const e = engine();
    const app = createAlertRoutes(container(e), authenticator(null));
    const res = await app.request("/subscribe", json({ email: "  Ada@Example.COM " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(e.subscribe.requestAsVisitor).toHaveBeenCalledWith({
      product: "bid",
      topic: "bid.new_sales",
      email: "ada@example.com",
      source: "web_home_alerts",
    });
    expect((await app.request("/subscribe", json({ email: "nope" }))).status).toBe(400);
  });

  it("previews a link with a GET and changes nothing", async () => {
    const e = engine();
    const app = createAlertRoutes(container(e), authenticator(null));
    const res = await app.request("/link-preview?kind=confirm&t=abc");
    expect(await res.json()).toEqual({ data: { state: "ready", maskedEmail: "a•••@example.com" } });
    await app.request("/link-preview?kind=stop&t=abc");
    expect(e.confirm.confirm).not.toHaveBeenCalled();
    expect(e.stop.stop).not.toHaveBeenCalled();
    expect((await app.request("/link-preview?kind=other&t=abc")).status).toBe(400);
  });

  it("confirms only on a POST", async () => {
    const e = engine();
    const app = createAlertRoutes(container(e), authenticator(null));
    expect((await app.request("/confirm?t=abc")).status).toBe(404);
    const res = await app.request("/confirm", json({ token: "abc" }));
    expect(await res.json()).toEqual({ ok: true, outcome: "confirmed" });
    expect(e.confirm.confirm).toHaveBeenCalledWith("abc", "bid");
  });

  it("stops every topic, one topic, or one-click, and answers 400 for a link that does not work", async () => {
    const e = engine();
    const app = createAlertRoutes(container(e), authenticator(null));
    await app.request("/stop", json({ token: "t" }));
    expect(e.stop.stop).toHaveBeenLastCalledWith("t", "bid", { scope: "all" });
    await app.request("/stop", json({ token: "t", scope: "topic", topic: "bid.searches" }));
    expect(e.stop.stop).toHaveBeenLastCalledWith("t", "bid", {
      scope: "topic",
      topic: "bid.searches",
    });
    await app.request("/stop", json({ token: "t", via: "one_click" }));
    expect(e.stop.stopOneClick).toHaveBeenCalledWith("t", "bid");
    expect((await app.request("/stop", json({ token: "t", scope: "topic" }))).status).toBe(400);
    e.stop.stop.mockResolvedValue("invalid");
    expect((await app.request("/stop", json({ token: "bad" }))).status).toBe(400);
  });
});

describe("a signed-in client's alert routes", () => {
  it("needs a session", async () => {
    const app = createAlertRoutes(container(), authenticator(null));
    expect((await app.request("/me")).status).toBe(401);
  });

  it("reads and sets the client's own switches", async () => {
    const e = engine();
    const app = createAlertRoutes(container(e), authenticator({ role: "client" }));
    expect((await app.request("/me")).status).toBe(200);
    const res = await app.request("/me/topics/bid.new_sales", {
      ...json({ on: true, email: false }),
      method: "PUT",
    });
    expect(res.status).toBe(200);
    expect(e.preferences.setTopic).toHaveBeenCalledWith({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      on: true,
      email: false,
    });
  });

  it("says why when an address cannot be switched on", async () => {
    const e = engine();
    e.preferences.setTopic.mockResolvedValue("unverified");
    const app = createAlertRoutes(container(e), authenticator({ role: "client" }));
    const res = await app.request("/me/topics/bid.new_sales", {
      ...json({ on: true }),
      method: "PUT",
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, reason: "unverified" });
    const bad = await app.request("/me/topics/shop.releases", {
      ...json({ on: true }),
      method: "PUT",
    });
    expect(bad.status).toBe(400);
  });
});

describe("the first sale-alerts routes", () => {
  it("still confirm, preview and one-click stop, and say when they go", async () => {
    const e = engine();
    const app = createLegacySaleAlertRoutes(container(e));
    const confirm = await app.request("/confirm", json({ token: "old" }));
    expect(await confirm.json()).toEqual({ ok: true, outcome: "confirmed" });
    expect(confirm.headers.get("Sunset")).toBe("Mon, 15 Feb 2027 00:00:00 GMT");
    expect(confirm.headers.get("Deprecation")).toBe("true");

    const preview = await app.request("/unsubscribe/preview?t=old");
    expect(await preview.json()).toEqual({ ok: true, data: { email: "a•••@example.com" } });

    const stop = await app.request("/unsubscribe?t=old", { method: "POST" });
    expect(stop.status).toBe(200);
    expect(e.stop.stopOneClick).toHaveBeenCalledWith("old", "bid");
    e.stop.stopOneClick.mockResolvedValue("invalid");
    expect((await app.request("/unsubscribe?t=bad", { method: "POST" })).status).toBe(400);
  });

  it("signs a visitor up through the old address", async () => {
    const e = engine();
    const app = createLegacySaleAlertRoutes(container(e));
    await app.request("/subscribe", json({ email: "ada@example.com" }));
    expect(e.subscribe.requestAsVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", topic: "bid.new_sales" }),
    );
  });
});

describe("GET /admin/sales/:id/announce-preview", () => {
  const id = "0b8a8e0e-1111-4222-8333-444455556666";
  it("tells staff who manage auctions how many people would hear", async () => {
    const app = createAdminSaleAnnounceRoutes(
      container(),
      authenticator({ role: "staff", staffRoles: ["sales_manager"] }),
    );
    const res = await app.request(`/${id}/announce-preview`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { subscribers: 1284 } });
  });

  it("refuses a client", async () => {
    const app = createAdminSaleAnnounceRoutes(container(), authenticator({ role: "client" }));
    expect((await app.request(`/${id}/announce-preview`)).status).toBe(403);
  });
});
