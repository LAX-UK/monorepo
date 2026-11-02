import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPdf = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/http/payout-statement-proxy.server", () => ({
  fetchLegalEntityPayoutStatementPdf: fetchPdf,
}));
vi.mock("@/lib/bff/public-origin-url.server", () => ({
  resolvePublicOriginUrl: (path: string) => new URL(path, "https://test.lax.bid/"),
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ legalEntityId: "le-1", payoutId: "p-1" }) };
const call = () => GET(new Request("https://test.lax.bid/x"), context);

describe("payout statement route", () => {
  beforeEach(() => fetchPdf.mockReset());

  it("passes on the redirect to the PDF", async () => {
    fetchPdf.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://files.example/s.pdf" } }),
    );
    const res = await call();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://files.example/s.pdf");
  });

  it.each([503, 422, 404, 500, 200])(
    "sends a %i to the error page, never raw JSON",
    async (status) => {
      fetchPdf.mockResolvedValue(new Response("{}", { status }));
      const res = await call();
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(
        "https://test.lax.bid/legal-entities/le-1/payouts/p-1/statement/unavailable",
      );
    },
  );

  it("treats a redirect without a location as a failure", async () => {
    fetchPdf.mockResolvedValue(new Response(null, { status: 302 }));
    expect((await call()).status).toBe(303);
  });
});
