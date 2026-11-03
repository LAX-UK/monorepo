import { afterEach, describe, expect, it, vi } from "vitest";
import { requestFlashClear } from "./flash-clear.client";

describe("requestFlashClear", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the page path to the flash route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestFlashClear("/api/flash", "/selling/new");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flash",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "/selling/new" }),
      }),
    );
  });

  it("never throws when the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(requestFlashClear("/api/flash", "/selling/new")).resolves.toBeUndefined();
  });
});
