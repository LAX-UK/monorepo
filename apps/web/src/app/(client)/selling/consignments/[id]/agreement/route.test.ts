import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrent = vi.fn();
const fetchPdf = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({ session: { getCurrent } }),
}));
vi.mock("@/lib/data/http/workspace-selling.server", () => ({
  fetchServerAgreementPdf: (...args: unknown[]) => fetchPdf(...args),
}));

import { GET } from "./route";

const call = () =>
  GET(new Request("https://lax.test/selling/consignments/sub-1/agreement"), {
    params: Promise.resolve({ id: "sub-1" }),
  });

describe("GET /selling/consignments/[id]/agreement", () => {
  beforeEach(() => {
    getCurrent.mockReset().mockResolvedValue({ id: "user-1" });
    fetchPdf.mockReset();
  });

  it("passes the PDF through, never cached", async () => {
    fetchPdf.mockResolvedValue(new Response("%PDF-test"));
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers someone else's agreement exactly like a missing one", async () => {
    fetchPdf.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const theirs = await call();
    fetchPdf.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const missing = await call();
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());
  });

  it("answers a failed API as unavailable", async () => {
    fetchPdf.mockRejectedValueOnce(new Error("down"));
    expect((await call()).status).toBe(503);
  });

  it("needs a signed-in member", async () => {
    getCurrent.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(fetchPdf).not.toHaveBeenCalled();
  });
});
