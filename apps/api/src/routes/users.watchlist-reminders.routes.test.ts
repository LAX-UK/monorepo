import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubUserRouteServices } from "../testing/stub-user-route-services.js";
import { createUserRoutes } from "./users.js";

const LOT = "9b7d0a52-1f43-4b7a-8a55-0c2f6e1d3a90";

function app(remindersHttp: Record<string, unknown>) {
  const container = {
    env: {},
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes: stubUserRouteServices({ watchlistRemindersHttp: remindersHttp as never }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "user-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const hono = new Hono();
  hono.route("/users", createUserRoutes(container, authenticator));
  return hono;
}

describe("watched-lot reminder routes", () => {
  it("lists the person's reminders", async () => {
    const list = vi.fn(async () => ({ kind: "ok", data: [{ lotId: LOT }] }));
    const res = await app({ list }).request("/users/me/watchlist/reminders");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ lotId: LOT }] });
    expect(list).toHaveBeenCalledWith("user-1");
  });

  it("sets a reminder from a validated body", async () => {
    const set = vi.fn(async () => ({ kind: "ok", data: { lotId: LOT } }));
    const res = await app({ set }).request(`/users/me/watchlist/${LOT}/reminder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "hour_before_close", note: " Frame " }),
    });
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith("user-1", LOT, { kind: "hour_before_close", note: "Frame" });
  });

  it("refuses an unknown reminder time before the service", async () => {
    const set = vi.fn();
    const res = await app({ set }).request(`/users/me/watchlist/${LOT}/reminder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "next_week" }),
    });
    expect(res.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it("answers 404 for a lot the person doesn't watch, and 204 on clear", async () => {
    const set = vi.fn(async () => ({
      kind: "err",
      error: { message: "Watch this lot first", status: 404, code: "not_watching" },
    }));
    const clear = vi.fn(async () => ({ kind: "no_content" }));
    const hono = app({ set, clear });
    const refused = await hono.request(`/users/me/watchlist/${LOT}/reminder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "sale_start" }),
    });
    expect(refused.status).toBe(404);
    const cleared = await hono.request(`/users/me/watchlist/${LOT}/reminder`, { method: "DELETE" });
    expect(cleared.status).toBe(204);
    expect(clear).toHaveBeenCalledWith("user-1", LOT);
  });
});
