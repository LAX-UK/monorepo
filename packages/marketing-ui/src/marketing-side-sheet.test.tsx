import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingSideSheet } from "./marketing-side-sheet.js";

describe("MarketingSideSheet", () => {
  it("renders a 576px right sheet with title, description, and body at lg", () => {
    render(
      <MarketingSideSheet
        open
        onOpenChange={() => {}}
        title="Enquiry"
        description="Tell us how to reach you."
      >
        <p>Form body</p>
      </MarketingSideSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Enquiry" });
    expect(dialog.className).toContain("lg:w-[36rem]");
    expect(screen.getByText("Tell us how to reach you.")).toBeInTheDocument();
    expect(screen.getByText("Form body")).toBeInTheDocument();
  });

  it("requests close from the dismiss control", () => {
    const onOpenChange = vi.fn();
    render(
      <MarketingSideSheet open onOpenChange={onOpenChange} title="Enquiry">
        <p>Body</p>
      </MarketingSideSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing while closed", () => {
    render(
      <MarketingSideSheet open={false} onOpenChange={() => {}} title="Enquiry">
        <p>Body</p>
      </MarketingSideSheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("draws a 12px label title by default and a heading-size title on request", () => {
    const { rerender } = render(
      <MarketingSideSheet open onOpenChange={() => {}} title="Send an enquiry">
        <p>Body</p>
      </MarketingSideSheet>,
    );
    const label = screen.getByRole("heading", { name: "Send an enquiry" }).className;
    expect(label).toContain("text-xs");
    expect(label).not.toMatch(/uppercase|tracking-/);
    rerender(
      <MarketingSideSheet open onOpenChange={() => {}} title="Send an enquiry" titleCase="sentence">
        <p>Body</p>
      </MarketingSideSheet>,
    );
    expect(screen.getByRole("heading", { name: "Send an enquiry" }).className).toContain(
      "text-2xl",
    );
  });
});
