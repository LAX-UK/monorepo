import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAdminFlashClear } from "./flash-clear.client";

describe("requestAdminFlashClear", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the page path to the flash route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestAdminFlashClear("/admin/clients");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/flash",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "/admin/clients" }),
      }),
    );
  });

  it("never throws when the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(requestAdminFlashClear("/admin/clients")).resolves.toBeUndefined();
  });
});
