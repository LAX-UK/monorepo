// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const deleteDataExportCopyAction = vi.fn();
const assign = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/data-export-actions.server", () => ({
  deleteDataExportCopyAction: (id: string) => deleteDataExportCopyAction(id),
}));

const { DataExportReadyActions } = await import("./data-export-ready-actions.client");

describe("DataExportReadyActions", () => {
  beforeEach(() => {
    deleteDataExportCopyAction.mockReset();
    refresh.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
    HTMLFormElement.prototype.requestSubmit = vi.fn();
  });
  afterEach(cleanup);

  it("posts the copy's id to the download route", () => {
    const { container } = render(<DataExportReadyActions exportId="exp_1" />);
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/account/privacy/download/file");
    expect(form?.getAttribute("method")).toBe("post");
    expect(container.querySelector('input[name="id"]')?.getAttribute("value")).toBe("exp_1");
    expect(container.querySelector('input[name="resumed"]')).toBeNull();
    expect(HTMLFormElement.prototype.requestSubmit).not.toHaveBeenCalled();
  });

  it("on return from signing in, presses Download once and marks the post as resumed", () => {
    const { container } = render(<DataExportReadyActions exportId="exp_1" resume />);
    expect(container.querySelector('input[name="resumed"]')?.getAttribute("value")).toBe("1");
    expect(HTMLFormElement.prototype.requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("deletes the copy and refreshes", async () => {
    deleteDataExportCopyAction.mockResolvedValue({ status: "deleted" });
    render(<DataExportReadyActions exportId="exp_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete this copy" }));
    await act(async () => {});
    expect(deleteDataExportCopyAction).toHaveBeenCalledWith("exp_1");
    expect(refresh).toHaveBeenCalled();
  });

  it("reports a failed delete and keeps the copy on the page", async () => {
    deleteDataExportCopyAction.mockResolvedValue({ status: "error", message: "Not deleted." });
    render(<DataExportReadyActions exportId="exp_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete this copy" }));
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("Not deleted.");
    expect(refresh).not.toHaveBeenCalled();
  });
});
