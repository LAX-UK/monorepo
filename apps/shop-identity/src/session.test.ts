import { Hono } from "hono";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createPgShopSessionRepository } from "./db/shop-session.repository.js";
import {
  OIDC_ID_TOKEN_COOKIE_NAME,
  clearOidcIdTokenCookie,
  readOidcIdToken,
  writeOidcIdTokenCookie,
} from "./session.js";

describe("Shop OIDC logout hint cookie", () => {
  it("stores a host-only HTTP-only token and reads only compact JWTs", async () => {
    const app = new Hono();
    app.get("/write", (c) => {
      writeOidcIdTokenCookie(c, "header.payload.signature", true);
      return c.body(null);
    });
    app.get("/read", (c) => c.text(readOidcIdToken(c) ?? "missing"));

    const written = await app.request("/write");
    const setCookie = written.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${OIDC_ID_TOKEN_COOKIE_NAME}=header.payload.signature`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("Domain=");

    const valid = await app.request("/read", {
      headers: { cookie: `${OIDC_ID_TOKEN_COOKIE_NAME}=header.payload.signature` },
    });
    expect(await valid.text()).toBe("header.payload.signature");

    const malformed = await app.request("/read", {
      headers: { cookie: `${OIDC_ID_TOKEN_COOKIE_NAME}=not-a-jwt` },
    });
    expect(await malformed.text()).toBe("missing");
  });

  it("expires the logout hint at the same path", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      clearOidcIdTokenCookie(c);
      return c.body(null);
    });

    const response = await app.request("/");
    expect(response.headers.get("set-cookie")).toContain(
      `${OIDC_ID_TOKEN_COOKIE_NAME}=; Max-Age=0; Path=/`,
    );
  });
});

describe("Shop back-channel logout persistence", () => {
  it("records jti and invalidates the targeted sid in one transaction", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    const release = vi.fn();
    const pool = {
      connect: async () => ({ query, release }),
    } as unknown as Pool;

    await expect(
      createPgShopSessionRepository(pool).consumeLogoutToken({
        jti: "jti-1",
        sid: "sid-1",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      }),
    ).resolves.toBe("consumed");
    expect(query.mock.calls[1]?.[0]).toContain("shop_logout_token_replay");
    expect(query.mock.calls[2]?.[0]).toContain("where sid = $1");
    expect(query.mock.calls[2]?.[1]).toEqual(["sid-1"]);
    expect(query.mock.calls[3]?.[0]).toBe("commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects replay without invalidating sessions again", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    const pool = {
      connect: async () => ({ query, release: vi.fn() }),
    } as unknown as Pool;

    await expect(
      createPgShopSessionRepository(pool).consumeLogoutToken({
        jti: "already-consumed",
        sub: "user-1",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      }),
    ).resolves.toBe("replay");
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2]?.[0]).toBe("rollback");
  });

  it("authenticates without persisting an id_token", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const pool = { query } as unknown as Pool;

    await createPgShopSessionRepository(pool).authenticate({
      id: "session-1",
      subject: "subject-1",
      sid: "sid-1",
    });

    expect(query.mock.calls[0]?.[0]).not.toContain("id_token");
    expect(query.mock.calls[0]?.[1]).toEqual(["session-1", "subject-1", "sid-1"]);
  });
});
