import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SortableList } from "./sortable-list.js";

type Row = { id: string; name: string };
const ROWS: Row[] = [
  { id: "a", name: "Flora Powers" },
  { id: "b", name: "Ines Varga" },
  { id: "c", name: "Tom Hale" },
];

function Harness({ invalidId }: { invalidId?: string }) {
  const [rows, setRows] = useState(ROWS);
  return (
    <SortableList
      label="Featured artists"
      items={rows}
      getKey={(row) => row.id}
      itemName={(row) => row.name}
      renderItem={(row) => <span>{row.name}</span>}
      invalid={(row) => row.id === invalidId}
      onMove={(from, to) =>
        setRows((current) => {
          const next = [...current];
          const [moved] = next.splice(from, 1);
          if (moved) next.splice(to, 0, moved);
          return next;
        })
      }
      onRemove={(index) => setRows((current) => current.filter((_, at) => at !== index))}
    />
  );
}

const order = () =>
  within(screen.getByRole("list", { name: "Featured artists" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/^\d+/, ""));

describe("SortableList", () => {
  it("moves a row with the arrow keys on its handle, keeps focus there and announces it", () => {
    render(<Harness />);
    const handle = screen.getByRole("button", { name: "Move Flora Powers" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(order()).toEqual(["Ines Varga", "Flora Powers", "Tom Hale"]);
    expect(screen.getByRole("button", { name: "Move Flora Powers" })).toHaveFocus();
    expect(screen.getByText("Flora Powers moved to position 2 of 3.")).toBeInTheDocument();
  });

  it("moves with the buttons, which stop at either end", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Move Flora Powers up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Tom Hale down" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move Tom Hale up" }));
    expect(order()).toEqual(["Flora Powers", "Tom Hale", "Ines Varga"]);
  });

  it("reorders by dragging a row onto another", () => {
    render(<Harness />);
    const [first, , third] = within(screen.getByRole("list")).getAllByRole("listitem");
    if (!first || !third) throw new Error("rows missing");
    const dataTransfer = { effectAllowed: "" };
    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(third, { dataTransfer });
    fireEvent.drop(third, { dataTransfer });
    expect(order()).toEqual(["Ines Varga", "Tom Hale", "Flora Powers"]);
  });

  it("removes a row and announces it", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Ines Varga" }));
    expect(order()).toEqual(["Flora Powers", "Tom Hale"]);
    expect(screen.getByText("Ines Varga removed.")).toBeInTheDocument();
  });

  it("marks a row with a problem", () => {
    render(<Harness invalidId="b" />);
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => row.dataset.invalid ?? null)).toEqual([null, "true", null]);
  });

  it("is read-only without handlers, and keeps its controls but disables them while busy", () => {
    const { rerender } = render(
      <SortableList
        label="Featured artists"
        items={ROWS}
        getKey={(row) => row.id}
        itemName={(row) => row.name}
        renderItem={(row) => <span>{row.name}</span>}
      />,
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
    const onMove = vi.fn();
    rerender(
      <SortableList
        label="Featured artists"
        items={ROWS}
        getKey={(row) => row.id}
        itemName={(row) => row.name}
        renderItem={(row) => <span>{row.name}</span>}
        onMove={onMove}
        onRemove={vi.fn()}
        disabled
      />,
    );
    const handle = screen.getByRole("button", { name: "Move Ines Varga" });
    expect(handle).toBeDisabled();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove Ines Varga" })).toBeDisabled();
  });
});
