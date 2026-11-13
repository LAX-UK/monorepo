import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: (href: string) => redirect(href),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "sec-fetch-site": "same-origin" }),
}));
vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({
    buying: { scope: async () => ({ account: { kind: "personal", id: "me" } }) },
  }),
}));
const loadPurchaseSources = vi.fn();
vi.mock("@/lib/purchases/purchase-sources.server", () => ({
  loadPurchaseSources: () => loadPurchaseSources(),
}));
vi.mock("@/lib/reoffer/bidder-reoffer.server", () => ({ reofferBoughtOn: async () => null }));
const findRecordAccount = vi.fn();
vi.mock("@/lib/legal-entity/remembered-account.server", () => ({
  findRecordAccount: (...args: unknown[]) => findRecordAccount(...args),
}));

const { default: PurchaseDetailPage } = await import("./page");

const open = (lotId: string) =>
  PurchaseDetailPage({
    params: Promise.resolve({ lotId }),
    searchParams: Promise.resolve({}),
  });

/**
 * A buyer opening a purchase that is not theirs gets "not found", exactly as for a lot that does
 * not exist: never the access page, which would confirm the purchase is there.
 */
describe("purchase detail: someone else's purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPurchaseSources.mockResolvedValue({ rows: [] });
  });

  it("is not found when the lot belongs to another person", async () => {
    // The API answers a stranger's record exactly like a missing one.
    findRecordAccount.mockResolvedValue({ kind: "not_found" });
    await expect(open("someone-elses-lot")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("asks for the record's account with the lot and the page to come back to", async () => {
    findRecordAccount.mockResolvedValue({ kind: "not_found" });
    await expect(open("lot-9")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findRecordAccount).toHaveBeenCalledWith("purchase", "lot-9");
  });
});
