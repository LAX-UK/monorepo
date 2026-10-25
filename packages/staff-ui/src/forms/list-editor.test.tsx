import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListEditor } from "./list-editor.js";

const rows = [
  { id: "a", period: "1990s" },
  { id: "b", period: "2005" },
];

function setup(items = rows) {
  const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onMove: vi.fn() };
  render(
    <ListEditor
      items={items}
      getKey={(item) => item.id}
      renderItem={(item) => <span>{item.period}</span>}
      itemLabel={(index) => `provenance line ${index + 1}`}
      addLabel="Add provenance line"
      emptyText="No provenance yet."
      max={3}
      {...handlers}
    />,
  );
  return handlers;
}

describe("ListEditor", () => {
  it("moves and removes a row by its name, and cannot move past either end", () => {
    const { onMove, onRemove } = setup();
    expect(screen.getByRole("button", { name: "Move provenance line 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move provenance line 2 down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move provenance line 2 up" }));
    expect(onMove).toHaveBeenCalledWith(1, 0);
    fireEvent.click(screen.getByRole("button", { name: "Remove provenance line 1" }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("says when the list is empty and adds a row", () => {
    const { onAdd } = setup([]);
    expect(screen.getByText("No provenance yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add provenance line" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
