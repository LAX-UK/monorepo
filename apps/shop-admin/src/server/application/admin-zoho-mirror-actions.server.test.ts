import { describe, expect, it, vi } from "vitest";

const { fetchAdminJson } = vi.hoisted(() => ({ fetchAdminJson: vi.fn() }));
vi.mock("./load-admin-data", () => ({ fetchAdminJson }));

const { loadZohoMirrorCells } = await import("./admin-zoho-mirror-actions.server");

const A = "6c1c2d3e-0000-4000-8000-00000000000a";
const B = "6c1c2d3e-0000-4000-8000-00000000000b";

function item(id: string, state: string) {
  return {
    entity: "order",
    id,
    state,
    consumer: "zoho_fulfilment",
    notApplicableReason: state === "not_applicable" ? "not_paid" : null,
    mode: "live",
    lastAttemptAt: null,
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: "a redacted reason",
  };
}

describe("loadZohoMirrorCells", () => {
  it("asks the batched status read once for the page, and returns only the badge per id", async () => {
    fetchAdminJson.mockReset();
    fetchAdminJson.mockResolvedValue({
      status: "ok",
      data: { items: [item(A, "failed"), item(B, "not_applicable")] },
    });
    const cells = await loadZohoMirrorCells("order", [A, B, A]);
    expect(fetchAdminJson).toHaveBeenCalledTimes(1);
    expect(fetchAdminJson).toHaveBeenCalledWith(`zoho-mirror/statuses?entity=order&ids=${A},${B}`);
    // Nothing beyond the badge reaches the browser: no error text, no references.
    expect(cells).toEqual({
      [A]: { state: "failed", label: "Not in Zoho", tone: "danger", shape: "alert" },
      [B]: null,
    });
  });

  it("never asks about more than one page of a list (the batch limit)", async () => {
    fetchAdminJson.mockReset();
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [] } });
    const ids = Array.from({ length: 150 }, (_, n) => `id-${n}`);
    await loadZohoMirrorCells("order", ids);
    const path = fetchAdminJson.mock.calls[0]?.[0] as string;
    expect(path.split("ids=")[1]?.split(",")).toHaveLength(100);
  });

  it("returns null when the read fails, so the column claims nothing", async () => {
    fetchAdminJson.mockReset();
    fetchAdminJson.mockResolvedValue({ status: "forbidden" });
    expect(await loadZohoMirrorCells("order", [A])).toBeNull();
  });

  it("refuses an unknown record kind without reading, and reads nothing for no ids", async () => {
    fetchAdminJson.mockReset();
    expect(await loadZohoMirrorCells("invoice" as never, [A])).toBeNull();
    expect(await loadZohoMirrorCells("order", [])).toEqual({});
    expect(fetchAdminJson).not.toHaveBeenCalled();
  });
});
