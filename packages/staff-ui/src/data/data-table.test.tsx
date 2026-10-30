import { fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
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

function SelectableTable({
  onRowOpen = vi.fn(),
  initial = [],
  matching,
}: {
  onRowOpen?: (row: Row) => void;
  initial?: string[];
  matching?: { total: number };
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initial));
  const [allMatching, setAllMatching] = React.useState(false);
  return (
    <DataTable
      label="People"
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      onRowOpen={onRowOpen}
      selectedIds={selected}
      onSelectedIdsChange={setSelected}
      {...(matching
        ? {
            selectAllMatching: {
              total: matching.total,
              active: allMatching,
              onActiveChange: setAllMatching,
            },
          }
        : {})}
      bulkActions={(chosen, scope) => (
        <button type="button">
          Export {scope.allMatching ? `all ${scope.count}` : chosen.map((r) => r.id).join(",")}
        </button>
      )}
      bulkNoun={{ one: "person", other: "people" }}
    />
  );
}

function selectionCell(index: number): HTMLElement {
  return bodyRows()[index]?.querySelector("[data-staff-select-cell]") as HTMLElement;
}

describe("DataTable selection", () => {
  it("selects the row from anywhere in the checkbox cell and never opens it", () => {
    const onRowOpen = vi.fn();
    render(<SelectableTable onRowOpen={onRowOpen} />);
    fireEvent.click(selectionCell(0));
    expect(onRowOpen).not.toHaveBeenCalled();
    expect(bodyRows()[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(selectionCell(0));
    expect(bodyRows()[0]).toHaveAttribute("aria-selected", "false");
  });

  it("toggles once when the checkbox itself is clicked", () => {
    render(<SelectableTable />);
    fireEvent.click(within(grid()).getByRole("checkbox", { name: "Select row 2" }));
    expect(bodyRows()[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Export b" })).toBeInTheDocument();
  });

  it("selects a range with Shift+click, and toggles the focused row with X", () => {
    render(<SelectableTable />);
    fireEvent.click(selectionCell(0));
    fireEvent.click(selectionCell(2), { shiftKey: true });
    expect(screen.getByRole("button", { name: "Export a,b,c" })).toBeInTheDocument();
    fireEvent.keyDown(bodyRows()[1] as HTMLElement, { key: "x" });
    expect(bodyRows()[1]).toHaveAttribute("aria-selected", "false");
  });

  it("clears the selection with Escape", () => {
    render(<SelectableTable initial={["a", "b"]} />);
    fireEvent.keyDown(bodyRows()[0] as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("selects every row on the page from anywhere in the header cell", () => {
    render(<SelectableTable />);
    fireEvent.click(grid().querySelector("thead [data-staff-select-cell]") as HTMLElement);
    expect(screen.getByRole("button", { name: "Export a,b,c" })).toBeInTheDocument();
  });

  it("offers every matching row once the page is selected, and acts on the filter", () => {
    render(<SelectableTable matching={{ total: 312 }} initial={["a", "b", "c"]} />);
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    fireEvent.click(within(bar).getByRole("button", { name: "Select all 312 matching" }));
    expect(bar).toHaveTextContent("All 312 people selected");
    expect(screen.getByRole("button", { name: "Export all 312" })).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "Select this page only" }));
    expect(bar).toHaveTextContent("3 people selected");
  });

  it("drops the all-matching scope as soon as one row is unselected", () => {
    render(<SelectableTable matching={{ total: 312 }} initial={["a", "b", "c"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Select all 312 matching" }));
    fireEvent.click(selectionCell(0));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent(
      "2 people selected",
    );
  });

  it("marks the page while the bulk-action bar shows, so the page keeps room for it", () => {
    const { rerender } = render(<SelectableTable initial={["a"]} />);
    expect(document.querySelector("[data-staff-bulk-bar]")).toBeInTheDocument();
    rerender(<SelectableTable key="clear" />);
    expect(document.querySelector("[data-staff-bulk-bar]")).not.toBeInTheDocument();
  });
});

describe("DataTable sorting", () => {
  const names = () =>
    within(screen.getByRole("table", { name: "People" }))
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);

  it("shows the default sort on first load and only ever toggles its direction", () => {
    render(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        defaultSort={{ columnId: "total", direction: "desc" }}
      />,
    );
    const header = screen.getByRole("columnheader", { name: /Total/ });
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["Ada300", "Mary200", "Grace100"]);
    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("keeps the server's order for equal values in both directions", () => {
    const tied: Row[] = [
      { id: "a", name: "Ada", total: 100 },
      { id: "b", name: "Grace", total: 100 },
    ];
    render(
      <DataTable
        label="People"
        columns={columns}
        data={tied}
        getRowId={(r) => r.id}
        defaultSort={{ columnId: "total", direction: "desc" }}
      />,
    );
    expect(names()).toEqual(["Ada100", "Grace100"]);
  });

  it("asks a server-sorted list for the column's own first direction", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        label="People"
        columns={[
          {
            id: "total",
            header: "Total",
            numeric: true,
            sortable: true,
            defaultSortDirection: "desc",
            cell: (row: Row) => String(row.total),
          },
        ]}
        data={rows}
        getRowId={(r) => r.id}
        sort={null}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: "total", direction: "desc" });
  });
});

describe("DataTable layout", () => {
  it("keeps the header in view while the table fits its card", () => {
    render(<DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} />);
    expect(document.querySelector("[data-staff-sticky-header]")).toBeInTheDocument();
  });

  it("can turn the sticky header off", () => {
    render(
      <DataTable
        label="People"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        stickyHeader={false}
      />,
    );
    expect(document.querySelector("[data-staff-sticky-header]")).not.toBeInTheDocument();
  });

  it("draws its own card unless it sits inside a section", () => {
    const { container, rerender } = render(
      <DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} />,
    );
    expect(container.querySelector(".border-staff-line")).toBeInTheDocument();
    rerender(
      <DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} embedded />,
    );
    expect(container.querySelector(".border-staff-line")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-staff-lg")).not.toBeInTheDocument();
  });

  it("shortens text cells but never numeric ones", () => {
    render(<DataTable label="People" columns={columns} data={rows} getRowId={(r) => r.id} />);
    const firstRow = within(screen.getByRole("table", { name: "People" })).getAllByRole("row")[1];
    const [nameCell, totalCell] = firstRow?.querySelectorAll("td") ?? [];
    expect(nameCell?.querySelector("[data-staff-truncate]")).toBeInTheDocument();
    expect(totalCell?.querySelector("[data-staff-truncate]")).not.toBeInTheDocument();
  });
});

describe("DataTable phone cards", () => {
  it("leaves out an empty fact, so the others line up", () => {
    type Lot = { id: string; title: string; sale: string | null; ends: string };
    const { container } = render(
      <DataTable<Lot>
        label="Lots"
        getRowId={(row) => row.id}
        data={[{ id: "1", title: "Coastal Path", sale: null, ends: "27 Nov" }]}
        columns={[
          { id: "title", header: "Lot", mobile: "title", cell: (row) => row.title },
          { id: "sale", header: "Sale", mobile: "meta", cell: (row) => row.sale },
          { id: "ends", header: "Ends", mobile: "meta", cell: (row) => row.ends },
        ]}
      />,
    );
    const card = [...container.querySelectorAll("li")].find((li) =>
      li.textContent?.includes("Coastal Path"),
    );
    const facts = card?.querySelectorAll("span.truncate.min-w-0") ?? [];
    expect([...facts].map((fact) => fact.textContent)).toEqual(["27 Nov"]);
  });
});
