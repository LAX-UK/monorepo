import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepList } from "./step-list.js";

describe("StepList", () => {
  it("lists each step with its facts and date, and says its state in words", () => {
    render(
      <StepList
        label="Re-offer steps"
        items={[
          {
            id: "a",
            label: "Buyer default recorded",
            details: ["Invoice voided"],
            meta: "Tue 10 Nov",
            state: "done",
          },
          { id: "b", label: "Seller's agreement", state: "current" },
          { id: "c", label: "Offer to the next bidder", state: "todo" },
          { id: "d", label: "Seller declined", state: "stopped" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Re-offer steps" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Buyer default recorded. Done");
    expect(rows[0]).toHaveTextContent("Invoice voided");
    expect(rows[0]).toHaveTextContent("Tue 10 Nov");
    expect(rows[1]).toHaveTextContent("In progress");
    expect(rows[2]).toHaveTextContent("Not started");
    expect(rows[3]).toHaveTextContent("Stopped");
  });

  it("leaves out the date and facts a step does not have", () => {
    render(<StepList label="Steps" items={[{ id: "a", label: "Only step", state: "todo" }]} />);
    expect(screen.getByRole("listitem").querySelectorAll("p")).toHaveLength(1);
  });

  it("shows two facts that read the same, without a key clash", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <StepList
        label="Steps"
        items={[
          { id: "a", label: "Reminded", details: ["Email sent", "Email sent"], state: "done" },
        ]}
      />,
    );
    expect(screen.getAllByText("Email sent")).toHaveLength(2);
    expect(error.mock.calls.flat().map(String).join(" ")).not.toMatch(/same key/);
    error.mockRestore();
  });

  it("uses only kit tokens, never an arbitrary value", () => {
    const { container } = render(
      <StepList label="Steps" items={[{ id: "a", label: "Only step", state: "current" }]} />,
    );
    expect(container.innerHTML).not.toMatch(/-\[[^\]]+\]/);
  });
});
