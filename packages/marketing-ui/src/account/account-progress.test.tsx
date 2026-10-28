import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountProgress } from "./account-progress";

const STEPS = [
  { id: "won", label: "Won", date: "24 Oct", progress: "done" as const },
  { id: "payment", label: "Payment", date: "Due 7 Nov", progress: "current" as const },
  { id: "delivery", label: "Delivery", progress: "upcoming" as const },
];

describe("AccountProgress", () => {
  it("lists every step in order and marks the current one", () => {
    render(<AccountProgress label="Purchase progress" steps={STEPS} />);
    const list = screen.getByRole("list", { name: "Purchase progress" });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("says each step's state and shows its date when there is one", () => {
    render(<AccountProgress label="Purchase progress" steps={STEPS} />);
    expect(screen.getByText(", done")).toBeInTheDocument();
    expect(screen.getByText(", current step")).toBeInTheDocument();
    expect(screen.getByText(", not started")).toBeInTheDocument();
    expect(screen.getByText("Due 7 Nov")).toBeInTheDocument();
  });
});
