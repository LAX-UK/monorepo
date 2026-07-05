import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthJwtForSocket, resolveSocketHandshakeAuth } from "./socket-auth.client";

describe("fetchAuthJwtForSocket", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on server", async () => {
    await expect(fetchAuthJwtForSocket()).resolves.toBeNull();
  });

  it("returns token from auth issuer", async () => {
    vi.stubGlobal("window", {} as Window);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "jwt-abc" }),
    });

    await expect(fetchAuthJwtForSocket()).resolves.toBe("jwt-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/token$/),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal("window", {} as Window);
    fetchMock.mockResolvedValue({ ok: false });

    await expect(fetchAuthJwtForSocket()).resolves.toBeNull();
  });
});

describe("resolveSocketHandshakeAuth", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty auth on server without calling fetch", async () => {
    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty auth for guests without calling fetch", async () => {
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", { cookie: "lax_theme=dark" } as Document);

    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty auth when session cookie is present but token fetch fails", async () => {
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", {
      cookie: "better-auth.session_token=abc",
    } as Document);
    fetchMock.mockResolvedValue({ ok: false });

    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns token auth when session cookie is present and fetch succeeds", async () => {
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", {
      cookie: "__Secure-better-auth.session_token=abc",
    } as Document);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "jwt-abc" }),
    });

    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({ token: "jwt-abc" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
