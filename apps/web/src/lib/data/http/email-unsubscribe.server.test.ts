import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: () => "http://api.internal:3001",
}));

const { getUnsubscribePreview } = await import("./email-unsubscribe.server");

describe("getUnsubscribePreview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the public preview from the absolute internal API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          scope: "global",
          notificationType: null,
          email: "buyer@example.com",
        },
      }),
    );

    await getUnsubscribePreview("token/with spaces");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.internal:3001/email/unsubscribe/preview?t=token%2Fwith%20spaces",
      { cache: "no-store" },
    );
  });
});
