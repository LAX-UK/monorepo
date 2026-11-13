import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { openSignedAgreement } = await import("./open-signed-agreement");

const LOT = "11111111-1111-4111-8111-111111111111";

describe("openSignedAgreement", () => {
  beforeEach(() => fetchMock.mockReset());

  it("asks the API for the link at the click and sends the browser to it, uncached", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { url: "https://files.test/a.pdf?sig=1" } })),
    );
    const res = await openSignedAgreement(LOT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/admin/seller-proceeds/lots/${LOT}/signed-agreement/document`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://files.test/a.pdf?sig=1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it.each([403, 404])("passes the API's %i on without a link", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    const res = await openSignedAgreement(LOT);
    expect(res.status).toBe(status);
    expect(res.headers.get("location")).toBeNull();
  });

  it("refuses anything but a web link", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { url: "javascript:alert(1)" } })),
    );
    expect((await openSignedAgreement(LOT)).status).toBe(502);
  });
});
