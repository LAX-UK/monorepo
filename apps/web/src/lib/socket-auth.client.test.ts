import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthJwtForSocket } from "./socket-auth.client";

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
