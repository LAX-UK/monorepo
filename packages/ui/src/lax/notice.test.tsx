import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./index.js";

describe("Notice", () => {
  it("announces politely by default and immediately as an alert", () => {
    const { rerender } = render(<Notice title="Saved">Nothing else to do.</Notice>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    rerender(
      <Notice tone="danger" alert title="Failed">
        Try again.
      </Notice>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });

  it("is a note, not a live region, when quiet", () => {
    render(
      <Notice title="Buyers will read" quiet>
        Storage is free for 14 days.
      </Notice>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("note", { name: "Buyers will read" })).toBeTruthy();
  });

  it("renders a success tone with the success tokens", () => {
    render(
      <Notice tone="success" title="Checked in">
        Ada Lovelace
      </Notice>,
    );
    const notice = screen.getByRole("status");
    expect(notice.className).toContain("bg-lax-success-bg");
    expect(notice).toHaveTextContent("Ada Lovelace");
  });

  it("is named by its title", () => {
    render(
      <Notice alert tone="warning" title="Verification required">
        Complete verification before bidding.
      </Notice>,
    );
    expect(screen.getByRole("alert")).toHaveAccessibleName("Verification required");
  });
});
