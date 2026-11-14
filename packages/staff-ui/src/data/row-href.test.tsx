import { PlainLink } from "@auction/ui/lax";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrimaryCell } from "./cells.js";
import { DataTable, type DataTableProps } from "./data-table.js";
import { LIST_RETURN_STATE_KEY } from "./list-return.js";
import type { DataColumn } from "./types.js";

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: "a", name: "Ada" },
  { id: "b", name: "Grace" },
  { id: "c", name: "Mary" },
];
const hrefOf = (row: Row) => `/people/${row.id}`;

/** The title link navigates through `visit`, as a router's Link would. */
function columns(visit: (href: string) => void): DataColumn<Row>[] {
  const RouterLink: typeof PlainLink = ({ href, onClick, ...rest }) => (
    <PlainLink
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || modified || event.button !== 0) return;
        event.preventDefault();
        visit(String(href));
      }}
    />
  );
  return [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell href={hrefOf(row)} Link={RouterLink}>
          {row.name}
        </PrimaryCell>
      ),
    },
    { id: "note", header: "Note", cell: (row) => `Note for ${row.name}` },
  ];
}

function setup(props: Partial<DataTableProps<Row>> = {}) {
  const visit = vi.fn();
  render(
    <DataTable
      label="People"
      columns={columns(visit)}
      data={rows}
      getRowId={(row) => row.id}
      rowHref={hrefOf}
      {...props}
    />,
  );
  const grid = screen.getByRole("grid", { name: "People" });
  const bodyRows = within(grid).getAllByRole("row").slice(1);
  const noteCell = (index: number) =>
    within(bodyRows[index] as HTMLElement).getByText(`Note for ${rows[index]?.name}`);
  return { visit, grid, bodyRows, noteCell };
}

let open: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  open = vi.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => {
  open.mockRestore();
  window.history.replaceState(null, "", "/");
});

describe("DataTable rowHref: every row is a real link", () => {
  it("renders the title cell as an <a> to the record, so right-click offers Copy link", () => {
    const { grid } = setup();
    expect(within(grid).getByRole("link", { name: "Ada" })).toHaveAttribute("href", "/people/a");
  });

  it("follows the row's link on a click anywhere on the row", () => {
    const { visit, noteCell } = setup();
    fireEvent.click(noteCell(1));
    expect(visit).toHaveBeenCalledWith("/people/b");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a new tab on Cmd-click, Ctrl-click and middle-click, and stays on the list", () => {
    const { visit, noteCell } = setup();
    fireEvent.click(noteCell(0), { metaKey: true });
    fireEvent.click(noteCell(1), { ctrlKey: true });
    fireEvent(noteCell(2), new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(open.mock.calls.map((call) => call[0])).toEqual(["/people/a", "/people/b", "/people/c"]);
    expect(open).toHaveBeenCalledWith("/people/a", "_blank", "noopener");
    expect(visit).not.toHaveBeenCalled();
  });

  it("leaves a modified click on the title link to the browser", () => {
    const { visit, grid } = setup();
    const link = within(grid).getByRole("link", { name: "Ada" });
    // Seen last, after the table: whether anything stopped the browser's own new tab. (Then
    // stopped here, since jsdom cannot open one.)
    let preventedByTable: boolean | null = null;
    const observe = (event: Event) => {
      preventedByTable = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", observe);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
    document.removeEventListener("click", observe);
    expect(preventedByTable).toBe(false);
    expect(visit).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the focused row with Enter and in a new tab with Cmd+Enter or Ctrl+Enter", () => {
    const { visit, bodyRows } = setup();
    const second = bodyRows[1] as HTMLElement;
    second.focus();
    fireEvent.keyDown(second, { key: "Enter", metaKey: true });
    fireEvent.keyDown(second, { key: "Enter", ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith("/people/b", "_blank", "noopener");
    expect(visit).not.toHaveBeenCalled();
    fireEvent.keyDown(second, { key: "Enter" });
    expect(visit).toHaveBeenCalledWith("/people/b");
  });

  it("selects a range with Shift-click, on the row or on its title, without opening anything", () => {
    function Selectable() {
      const [selected, setSelected] = React.useState<Set<string>>(new Set());
      return (
        <DataTable
          label="People"
          columns={columns(visit)}
          data={rows}
          getRowId={(row) => row.id}
          rowHref={hrefOf}
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
        />
      );
    }
    const visit = vi.fn();
    render(<Selectable />);
    const grid = screen.getByRole("grid", { name: "People" });
    const firstCheckbox = within(grid).getByRole("checkbox", { name: "Select row 1" });
    fireEvent.click(firstCheckbox.closest("td") as HTMLElement);
    fireEvent.click(within(grid).getByRole("link", { name: "Mary" }), { shiftKey: true });
    const bodyRows = within(grid).getAllByRole("row").slice(1);
    expect(bodyRows.map((row) => row.getAttribute("aria-selected"))).toEqual([
      "true",
      "true",
      "true",
    ]);
    expect(visit).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("does not open the row when the click ends a text selection", () => {
    const { visit, noteCell } = setup();
    const cell = noteCell(0);
    const range = document.createRange();
    range.selectNodeContents(cell);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.click(cell);
    expect(visit).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
  });

  it("uses navigate when the row has no title link", () => {
    const navigate = vi.fn();
    render(
      <DataTable
        label="People"
        columns={[{ id: "name", header: "Name", cell: (row) => row.name }]}
        data={rows}
        getRowId={(row) => row.id}
        rowHref={hrefOf}
        navigate={navigate}
      />,
    );
    fireEvent.click(screen.getByRole("grid").querySelector("td") as HTMLElement);
    expect(navigate).toHaveBeenCalledWith("/people/a");
  });
});

describe("DataTable rowHref with a queue panel", () => {
  it("opens the panel on a plain click or Enter, and the record page in a new tab", () => {
    const onRowOpen = vi.fn();
    const { visit, grid, bodyRows, noteCell } = setup({ onRowOpen });
    fireEvent.click(within(grid).getByRole("link", { name: "Grace" }));
    fireEvent.click(noteCell(2));
    fireEvent.keyDown(bodyRows[0] as HTMLElement, { key: "Enter" });
    expect(onRowOpen.mock.calls.map(([row]) => row.id)).toEqual(["b", "c", "a"]);
    expect(visit).not.toHaveBeenCalled();
    fireEvent.click(noteCell(0), { metaKey: true });
    expect(open).toHaveBeenCalledWith("/people/a", "_blank", "noopener");
  });
});

describe("Back to a list", () => {
  it("restores the scroll, focuses the row that was opened and marks it briefly", () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState({ router: "kept" }, "", "/people?status=live&sort=-name");
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      Object.defineProperty(window, "scrollY", { configurable: true, value: 640 });

      const first = setup();
      fireEvent.click(first.noteCell(1));
      expect(first.visit).toHaveBeenCalledWith("/people/b");
      // The list's own history entry remembers the row, beside the router's state.
      const listEntry = window.history.state;
      expect(listEntry).toEqual({
        router: "kept",
        [LIST_RETURN_STATE_KEY]: { rowId: "b", scrollY: 640 },
      });
      first.grid.remove();

      // The record page, then Back to the list's entry.
      window.history.pushState(null, "", "/people/b");
      window.history.replaceState(listEntry, "", "/people?status=live&sort=-name");
      Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
      // jsdom has no layout: make the table layout count as shown.
      const offsetParent = vi
        .spyOn(HTMLElement.prototype, "offsetParent", "get")
        .mockReturnValue(document.body);

      const back = setup();
      expect(scrollTo).toHaveBeenCalledWith({ top: 640, left: 0, behavior: "instant" });
      const row = back.bodyRows[1] as HTMLElement;
      expect(row).toHaveFocus();
      expect(row).toHaveAttribute("data-staff-returned");
      expect(row).toHaveAttribute("tabindex", "0");
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(row).not.toHaveAttribute("data-staff-returned");
      // Read once: the mark is gone, the router's state stays.
      expect(window.history.state).toEqual({ router: "kept" });
      offsetParent.mockRestore();
      scrollTo.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts fresh when the list is reached another way than Back", () => {
    window.history.replaceState(null, "", "/people");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const first = setup();
    fireEvent.click(first.noteCell(0));
    first.grid.remove();

    // A link to the list: a new history entry, without the mark.
    window.history.pushState(null, "", "/people");
    const again = setup();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(again.bodyRows[0]).not.toHaveAttribute("data-staff-returned");
    scrollTo.mockRestore();
  });
});
