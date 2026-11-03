// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const replace = vi.fn();
const requestDataExportAction = vi.fn();
const assign = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));
vi.mock("@/server/application/data-export-actions.server", () => ({
  requestDataExportAction: () => requestDataExportAction(),
}));

const { RequestDataExportButton } = await import("./data-export-request-button.client");

async function settle() {
  await act(async () => {});
}

describe("RequestDataExportButton", () => {
  beforeEach(() => {
    requestDataExportAction.mockReset();
    refresh.mockReset();
    replace.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
  });
  afterEach(cleanup);

  it("sends the person through signing in again, back to this page to finish the request", async () => {
    requestDataExportAction.mockResolvedValue({ status: "reauth_required" });
    render(<RequestDataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: "Request your data" }));
    await settle();
    const href = String(assign.mock.calls[0]?.[0]);
    expect(href).toContain("/api/auth/login?");
    expect(decodeURIComponent(href)).toContain("returnTo=/account/privacy/download?resume=request");
    expect(href).toContain("intent=reauth");
  });

  it("on return, requests once without a press and refreshes to show progress", async () => {
    requestDataExportAction.mockResolvedValue({ status: "requested" });
    render(<RequestDataExportButton resume />);
    await settle();
    expect(requestDataExportAction).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/account/privacy/download");
    expect(assign).not.toHaveBeenCalled();
  });

  it("on return, says so instead of looping when the sign-in is still too old", async () => {
    requestDataExportAction.mockResolvedValue({ status: "reauth_required" });
    render(<RequestDataExportButton resume />);
    await settle();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("nothing was requested");
  });

  it("states the date a person can ask again when over the limit", async () => {
    requestDataExportAction.mockResolvedValue({
      status: "limited",
      message: "You can ask again from 20 November 2026.",
    });
    render(<RequestDataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: "Request your data" }));
    await settle();
    expect(screen.getByText(/ask again from 20 November 2026/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("never pretends a failure was a request", async () => {
    requestDataExportAction.mockResolvedValue({ status: "error", message: "Nothing was changed." });
    render(<RequestDataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: "Request your data" }));
    await settle();
    expect(screen.getByRole("alert").textContent).toBe("Nothing was changed.");
    expect(replace).not.toHaveBeenCalled();
  });
});
