import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table.js";
import type { DataColumn } from "./types.js";

type Row = { id: string; name: string; total: number };
const rows: Row[] = [
  { id: "a", name: "Ada", total: 300 },
  { id: "b", name: "Grace", total: 100 },
  { id: "c", name: "Mary", total: 200 },
];
const columns: DataColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
  {
    id: "total",
    header: "Total",
    numeric: true,
    sortable: true,
    sortValue: (row) => row.total,
    cell: (row) => String(row.total),
  },
];

function grid() {
  return screen.getByRole("grid", { name: "People" });
}

function bodyRows() {
  return within(grid()).getAllByRole("row").slice(1);
}

describe("DataTable", () => {
  it("moves row focus with the arrow keys and opens a row with Enter", () => {
    const onRowOpen = vi.fn();
    render(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        onRowOpen={onRowOpen}
      />,
    );
    const [first, second] = bodyRows();
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    first?.focus();
    fireEvent.keyDown(first as HTMLElement, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second as HTMLElement, { key: "Enter" });
    expect(onRowOpen).toHaveBeenCalledWith(rows[1]);
  });

  it("opens a row on click, but not when the click is on a link inside it", () => {
    const onRowOpen = vi.fn();
    render(
      <DataTable
        label="People"
        columns={[
          {
            id: "name",
            header: "Name",
            cell: (row) => (
              <a href={`/p/${row.id}`} onClick={(event) => event.preventDefault()}>
                {row.name}
              </a>
            ),
          },
        ]}
        data={rows}
        getRowId={(r) => r.id}
        onRowOpen={onRowOpen}
      />,
    );
    fireEvent.click(within(grid()).getByRole("link", { name: "Ada" }));
    expect(onRowOpen).not.toHaveBeenCalled();
    fireEvent.click(bodyRows()[0]?.querySelector("td") as HTMLElement);
    expect(onRowOpen).toHaveBeenCalledWith(rows[0]);
  });

  it("selects with Space, selects all, and shows the bulk-action bar with a count", () => {
    let selected = new Set<string>();
    const onChange = vi.fn((next: Set<string>) => {
      selected = next;
    });
    const { rerender } = render(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selectedIds={selected}
        onSelectedIdsChange={onChange}
        bulkActions={(chosen) => <button type="button">Export {chosen.length}</button>}
        bulkNoun={{ one: "person", other: "people" }}
      />,
    );
    fireEvent.keyDown(bodyRows()[1] as HTMLElement, { key: " " });
    expect([...selected]).toEqual(["b"]);
    rerender(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selectedIds={selected}
        onSelectedIdsChange={onChange}
        bulkActions={(chosen) => <button type="button">Export {chosen.length}</button>}
        bulkNoun={{ one: "person", other: "people" }}
      />,
    );
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent(
      "1 person selected",
    );
    expect(screen.getByRole("button", { name: "Export 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect([...selected].sort()).toEqual(["a", "b", "c"]);
  });

  it("sorts locally when a column has a sort value, and marks the header", () => {
    render(<DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    const table = screen.getByRole("table", { name: "People" });
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(["Grace100", "Mary200", "Ada300"]);
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("shows the empty, error and loading states in place of rows", () => {
    const { rerender } = render(
      <DataTable
        label="People"
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        empty={<p>No people yet</p>}
      />,
    );
    expect(screen.getByText("No people yet")).toBeInTheDocument();
    rerender(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        error={<p>Did not load</p>}
      />,
    );
    expect(screen.getByText("Did not load")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    rerender(
      <DataTable label="People" columns={columns} data={[]} getRowId={(r) => r.id} loading />,
    );
    expect(screen.getByRole("table", { name: "People" })).toHaveAttribute("aria-busy", "true");
  });
});
