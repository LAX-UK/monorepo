import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrent = vi.fn();
const fetchPdf = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({ session: { getCurrent } }),
}));
vi.mock("@/lib/purchases/purchase-invoice.server", () => ({
  fetchPurchaseInvoicePdf: (...args: unknown[]) => fetchPdf(...args),
}));

import { GET } from "./route";

const call = () =>
  GET(new Request("https://lax.test/purchases/lot-1/invoice"), {
    params: Promise.resolve({ lotId: "lot-1" }),
  });

describe("GET /purchases/[lotId]/invoice", () => {
  beforeEach(() => {
    getCurrent.mockReset().mockResolvedValue({ id: "user-1" });
    fetchPdf.mockReset();
  });

  it("passes the PDF through, never cached and never sniffed as another type", async () => {
    fetchPdf.mockResolvedValue(
      new Response("%PDF-test", {
        headers: { "content-disposition": 'attachment; filename="invoice-LAXB-1.pdf"' },
      }),
    );
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="invoice-LAXB-1.pdf"',
    );
  });

  it("answers a refusal as unavailable, with the API's status", async () => {
    fetchPdf.mockResolvedValue(new Response("{}", { status: 409 }));
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "invoice_unavailable" });
  });

  it("answers someone else's invoice exactly like a missing one", async () => {
    fetchPdf.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const theirs = await call();
    fetchPdf.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const missing = await call();
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());
  });

  it("answers a failed API as unavailable", async () => {
    fetchPdf.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await call()).status).toBe(503);
    fetchPdf.mockRejectedValueOnce(new Error("down"));
    expect((await call()).status).toBe(503);
  });

  it("needs a signed-in member", async () => {
    getCurrent.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetchPdf).not.toHaveBeenCalled();
  });
});
