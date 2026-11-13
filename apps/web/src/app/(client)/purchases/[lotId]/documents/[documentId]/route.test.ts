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

  it("answers every refusal and failure with the same uncached 404", async () => {
    const answers: Response[] = [];
    for (const status of [400, 401, 403, 404, 500, 502, 503, 204]) {
      fetchPdf.mockResolvedValueOnce(new Response(status === 204 ? null : "{}", { status }));
      answers.push(await call());
    }
    fetchPdf.mockRejectedValueOnce(new Error("down"));
    answers.push(await call());
    getCurrent.mockResolvedValueOnce(null);
    answers.push(await call());
    for (const res of answers) {
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "document_unavailable" });
    }
  });

  it("needs a signed-in member, and asks the API nothing without one", async () => {
    getCurrent.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(fetchPdf).not.toHaveBeenCalled();
  });
});
