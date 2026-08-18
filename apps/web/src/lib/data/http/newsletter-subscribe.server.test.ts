import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: () => "http://api.internal:3001",
}));
vi.mock("@/lib/data/http/server-request-headers", () => ({
  deriveSsrOrigin: async () => "https://lax.bid",
}));

const { forwardNewsletterSubscribe } = await import("./newsletter-subscribe.server");

describe("forwardNewsletterSubscribe", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the absolute internal API with the public request origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    await forwardNewsletterSubscribe({ email: "buyer@example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.internal:3001/newsletter/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://lax.bid",
        },
      }),
    );
  });
});
