import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  adminListSavedViewsAction: vi.fn(),
  adminCreateSavedViewAction: vi.fn(),
  adminRenameSavedViewAction: vi.fn(),
  adminReorderSavedViewsAction: vi.fn(),
  adminDeleteSavedViewAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-saved-views", () => actions);

import { createSavedViewsPort } from "./saved-views-port";

const row = { id: "a", label: "Drafts", query: "status=draft" };

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
});

describe("the Bid admin saved views port", () => {
  const port = createSavedViewsPort("bid-admin.lots");

  it("loads and creates for its own list", async () => {
    actions.adminListSavedViewsAction.mockResolvedValue({ ok: true, data: [row] });
    actions.adminCreateSavedViewAction.mockResolvedValue({ ok: true, data: row });

    expect(await port.load()).toEqual([row]);
    expect(actions.adminListSavedViewsAction).toHaveBeenCalledWith({ listKey: "bid-admin.lots" });
    expect(await port.create({ label: "Drafts", query: "status=draft" })).toEqual(row);
    expect(actions.adminCreateSavedViewAction).toHaveBeenCalledWith({
      listKey: "bid-admin.lots",
      label: "Drafts",
      query: "status=draft",
    });
  });

  it("renames, reorders and deletes", async () => {
    actions.adminRenameSavedViewAction.mockResolvedValue({ ok: true, data: row });
    actions.adminReorderSavedViewsAction.mockResolvedValue({ ok: true });
    actions.adminDeleteSavedViewAction.mockResolvedValue({ ok: true });

    expect(await port.rename("a", "Drafts")).toEqual(row);
    expect(actions.adminRenameSavedViewAction).toHaveBeenCalledWith("a", { label: "Drafts" });
    await port.reorder(["b", "a"]);
    expect(actions.adminReorderSavedViewsAction).toHaveBeenCalledWith({
      listKey: "bid-admin.lots",
      ids: ["b", "a"],
    });
    await port.remove("a");
    expect(actions.adminDeleteSavedViewAction).toHaveBeenCalledWith("a");
  });

  it.each([
    ["duplicate_label", "duplicate"],
    ["limit_reached", "limit"],
    ["order_changed", "stale"],
  ])("turns the API's %s into a %s error with its words", async (errorCode, code) => {
    actions.adminCreateSavedViewAction.mockResolvedValue({
      ok: false,
      error: "Say this.",
      status: 409,
      errorCode,
    });

    await expect(port.create({ label: "x", query: "" })).rejects.toMatchObject({
      name: "SavedViewsError",
      code,
      message: "Say this.",
    });
  });

  it("treats a missing view as changed elsewhere", async () => {
    actions.adminDeleteSavedViewAction.mockResolvedValue({
      ok: false,
      error: "View not found",
      status: 404,
    });

    await expect(port.remove("a")).rejects.toMatchObject({ code: "stale" });
  });

  it("gives a plain failure for anything else, and when the action cannot be reached", async () => {
    actions.adminListSavedViewsAction.mockResolvedValueOnce({
      ok: false,
      error: "internal detail",
      status: 500,
    });
    await expect(port.load()).rejects.toMatchObject({
      code: "failed",
      message: "Something went wrong. Try again.",
    });

    actions.adminListSavedViewsAction.mockRejectedValueOnce(new Error("network"));
    await expect(port.load()).rejects.toMatchObject({ code: "failed" });
  });
});
