import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BidDialogBoundary } from "./bid-dialog-boundary";

function Broken(): never {
  throw new Error("Loading chunk failed");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BidDialogBoundary", () => {
  it("shows its children while nothing has failed", () => {
    render(
      <BidDialogBoundary onDismiss={vi.fn()}>
        <p>the bid dialog</p>
      </BidDialogBoundary>,
    );
    expect(screen.getByText("the bid dialog")).toBeInTheDocument();
  });

  it("says bidding could not open, with a way to reload, when the dialog fails to load", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <BidDialogBoundary onDismiss={vi.fn()}>
        <Broken />
      </BidDialogBoundary>,
    );
    expect(screen.getByRole("dialog", { name: "Couldn't open bidding" })).toBeInTheDocument();
    expect(screen.getByText("Reload the page.")).toBeInTheDocument();

    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("tells the page when the notice is dismissed, so it forgets the failed opening", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onDismiss = vi.fn();
    render(
      <BidDialogBoundary onDismiss={onDismiss}>
        <Broken />
      </BidDialogBoundary>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
