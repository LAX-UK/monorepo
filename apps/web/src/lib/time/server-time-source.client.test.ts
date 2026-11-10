import { describe, expect, it, vi } from "vitest";
import { createBidApiTimeSource } from "./server-time-source.client";

describe("createBidApiTimeSource", () => {
  it("reads the server time without cookies or caching", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ serverNowMs: 1_700_000_000_000 }));
    const source = createBidApiTimeSource(fetchImpl as unknown as typeof fetch, "/api/bff/time");
    await expect(source.readServerNowMs()).resolves.toBe(1_700_000_000_000);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/bff/time",
      expect.objectContaining({ cache: "no-store", credentials: "omit" }),
    );
  });

  it("rejects a failed or malformed answer", async () => {
    const bad = (response: Response) =>
      createBidApiTimeSource((async () => response) as unknown as typeof fetch).readServerNowMs();
    await expect(bad(new Response("no", { status: 503 }))).rejects.toThrow();
    await expect(bad(Response.json({ serverNowMs: "soon" }))).rejects.toThrow();
  });
});
