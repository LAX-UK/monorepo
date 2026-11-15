import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, run: () => unknown) => run(),
}));
const ok = vi.fn().mockResolvedValue({ ok: true, data: { id: "doc-1" } });
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({
    adminDocuments: {
      attachSaleDocument: ok,
      removeSaleDocument: ok,
      attachLotDocument: ok,
      removeLotDocument: ok,
    },
  }),
}));

const actions = await import("./admin-documents");
const attach = { uploadObjectId: "u-1", kind: "condition_report", label: null };

describe("staff document changes drop the public page that lists them", () => {
  beforeEach(() => revalidateTag.mockClear());

  it.each([
    ["attaching", () => actions.adminAttachLotDocumentResultAction("lot-1", attach)],
    ["removing", () => actions.adminRemoveLotDocumentResultAction("lot-1", "doc-1")],
  ])("drops the lot page when %s a lot document", async (_label, run) => {
    await run();
    expect(revalidateTag).toHaveBeenCalledWith("public-lot:lot-1");
  });

  it.each([
    ["attaching", () => actions.adminAttachSaleDocumentResultAction("sale-1", attach)],
    ["removing", () => actions.adminRemoveSaleDocumentResultAction("sale-1", "doc-1")],
  ])("drops the sale page when %s a sale document", async (_label, run) => {
    await run();
    expect(revalidateTag).toHaveBeenCalledWith("public-sale:sale-1");
  });

  it("drops nothing when the API refused the change", async () => {
    ok.mockResolvedValueOnce({ ok: false, status: 403, message: "no", body: {} });
    await actions.adminRemoveLotDocumentResultAction("lot-1", "doc-1");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
