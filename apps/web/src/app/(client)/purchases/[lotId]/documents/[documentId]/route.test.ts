import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrent = vi.fn();
const fetchPdf = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({ session: { getCurrent } }),
}));
vi.mock("@/lib/purchases/purchase-invoice.server", () => ({
  fetchPurchaseDocumentPdf: (...args: unknown[]) => fetchPdf(...args),
}));

import { GET } from "./route";

const call = () =>
  GET(new Request("https://lax.test/purchases/lot-1/documents/doc-1"), {
    params: Promise.resolve({ lotId: "lot-1", documentId: "doc-1" }),
  });

describe("GET /purchases/[lotId]/documents/[documentId]", () => {
  beforeEach(() => {
    getCurrent.mockReset().mockResolvedValue({ id: "user-1" });
    fetchPdf.mockReset();
  });

  it("passes LAX's stored copy through, never cached and never sniffed as another type", async () => {
    fetchPdf.mockResolvedValue(
      new Response("%PDF-test", {
        headers: { "content-disposition": 'attachment; filename="invoice-INV-000123.pdf"' },
      }),
    );
    const res = await call();
    expect(fetchPdf).toHaveBeenCalledWith("lot-1", "doc-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="invoice-INV-000123.pdf"',
    );
  });

  it("answers a refusal as unavailable, and a failure as 503", async () => {
    fetchPdf.mockResolvedValue(new Response("{}", { status: 404 }));
    expect((await call()).status).toBe(404);
    fetchPdf.mockRejectedValue(new Error("down"));
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "document_unavailable" });
  });

  it("needs a signed-in member", async () => {
    getCurrent.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetchPdf).not.toHaveBeenCalled();
  });
});
