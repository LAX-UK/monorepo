// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const requestSaleChangeAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/selling-actions.server", () => ({
  requestSaleChangeAction: (...args: unknown[]) => requestSaleChangeAction(...args),
}));

const { SaleRequestDialog } = await import("./sale-request-dialog.client");

const ARTWORK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function open(current = 3) {
  render(
    <SaleRequestDialog
      artworkId={ARTWORK}
      artworkTitle="Harbour Print"
      current={current}
      triggerLabel="Request more"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Request more for Harbour Print" }));
  return screen.getByRole("dialog");
}

describe("SaleRequestDialog", () => {
  beforeEach(() => {
    requestSaleChangeAction.mockReset();
    refresh.mockReset();
  });
  afterEach(cleanup);

  it("opens from the row with the stepper one above what is available now", () => {
    const dialog = open(3);
    expect(dialog.textContent).toContain("Request more editions");
    expect(screen.getByLabelText("Editions available to sell")).toHaveProperty("value", "4");
    expect(dialog.textContent).toContain("1 more than now");
  });

  it("steps down to a smaller number and retitles the dialog", () => {
    open(3);
    const fewer = screen.getByRole("button", { name: "One fewer" });
    fireEvent.click(fewer);
    expect(screen.getByRole("dialog").textContent).toContain("The same as now");
    expect(screen.getByRole("button", { name: "Send request" })).toHaveProperty("disabled", true);
    fireEvent.click(fewer);
    expect(screen.getByRole("dialog").textContent).toContain("Sell fewer editions");
    expect(screen.getByRole("dialog").textContent).toContain("1 fewer than now");
  });

  it("stops the stepper at Shop's limits", () => {
    open(9);
    expect(screen.getByLabelText("Editions available to sell")).toHaveProperty("value", "10");
    expect(screen.getByRole("button", { name: "One more" })).toHaveProperty("disabled", true);
  });

  it("sends the new total and the trimmed note, then refreshes the page", async () => {
    requestSaleChangeAction.mockResolvedValue({ status: "ok", message: "Request sent." });
    open(3);
    fireEvent.click(screen.getByRole("button", { name: "One more" }));
    fireEvent.change(screen.getByLabelText(/Note for LAX/), {
      target: { value: "  For the autumn fair  " },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    });
    expect(requestSaleChangeAction).toHaveBeenCalledWith({
      artworkId: ARTWORK,
      requestedCount: 5,
      note: "For the autumn fair",
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open with the reason when LAX refuses", async () => {
    requestSaleChangeAction.mockResolvedValue({
      status: "error",
      message: "You already have a request waiting for this artwork.",
    });
    open(3);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "You already have a request waiting for this artwork.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
