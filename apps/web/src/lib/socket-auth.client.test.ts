import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSocketTicket, resolveSocketHandshakeAuth } from "./socket-auth.client";

describe("fetchSocketTicket", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on server", async () => {
    await expect(fetchSocketTicket()).resolves.toBeNull();
  });

  it("returns an opaque ticket from the same-origin BFF", async () => {
    vi.stubGlobal("window", {} as Window);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: "ticket-abc" }),
    });

    await expect(fetchSocketTicket()).resolves.toBe("ticket-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/ws-ticket",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal("window", {} as Window);
    fetchMock.mockResolvedValue({ ok: false });

    await expect(fetchSocketTicket()).resolves.toBeNull();
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
    vi.stubGlobal("window", undefined);
    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty auth when the BFF reports no session", async () => {
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", { cookie: "lax_theme=dark" } as Document);

    fetchMock.mockResolvedValue({ ok: false });

    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns ticket auth when the BFF succeeds", async () => {
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", {
      cookie: "",
    } as Document);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ticket: "ticket-abc" }),
    });

    await expect(resolveSocketHandshakeAuth()).resolves.toEqual({ ticket: "ticket-abc" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
