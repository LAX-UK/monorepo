import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/popover", () =>
  import("../test/radix-stubs.js").then((m) => m.popover),
);

const { CommandMenu } = await import("./command-menu.js");

function renderMenu(onPick = vi.fn(), onUnassign = vi.fn()) {
  render(
    <CommandMenu
      label="Assign thread"
      trigger={<button type="button">Assign</button>}
      searchPlaceholder="Find a colleague"
      groups={[
        {
          id: "staff",
          items: [
            {
              id: "u1",
              label: "Clara Mendes (you)",
              description: "Specialist · 9 open",
              checked: true,
              onSelect: () => onPick("u1"),
            },
            {
              id: "u2",
              label: "James Hale",
              description: "Specialist · 4 open",
              onSelect: () => onPick("u2"),
            },
          ],
        },
      ]}
      footer={[{ id: "none", label: "Unassign", onSelect: onUnassign }]}
      note="Thread and consignment move together."
    />,
  );
  return { onPick, onUnassign };
}

describe("CommandMenu", () => {
  it("opens from its trigger with a search, the options and the footer", () => {
    renderMenu();
    expect(screen.queryByPlaceholderText("Find a colleague")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(screen.getByPlaceholderText("Find a colleague")).toBeTruthy();
    expect(screen.getByText("James Hale")).toBeTruthy();
    expect(screen.getByText("Unassign")).toBeTruthy();
    expect(screen.getByText("Thread and consignment move together.")).toBeTruthy();
    expect(screen.getByText("(current)")).toBeTruthy();
  });

  it("runs the chosen option and closes", () => {
    const { onPick } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.click(screen.getByText("James Hale"));
    expect(onPick).toHaveBeenCalledWith("u2");
    expect(screen.queryByPlaceholderText("Find a colleague")).toBeNull();
  });

  it("filters by what is typed, keeping the footer", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.change(screen.getByPlaceholderText("Find a colleague"), {
      target: { value: "james" },
    });
    expect(screen.queryByText("Clara Mendes (you)")).toBeNull();
    expect(screen.getByText("James Hale")).toBeTruthy();
    expect(screen.getByText("Unassign")).toBeTruthy();
  });
});
