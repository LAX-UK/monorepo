import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataColumn } from "./types.js";

vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);
vi.mock("@auction/ui/components/sheet", () =>
  import("../test/radix-stubs.js").then((m) => m.sheet),
);

const { StaffShortcutsProvider, useStaffShortcuts } = await import("../shell/shortcuts.js");
const { DataTable } = await import("./data-table.js");
const { FilterSheet } = await import("./filter-sheet.js");

type Row = { id: string; title: string };
const columns: DataColumn<Row>[] = [{ id: "title", header: "Title", cell: (row) => row.title }];
const data: Row[] = [
  { id: "a", title: "Golden Hour" },
  { id: "b", title: "Blue Study" },
];

function press(key: string, target: EventTarget = document.body) {
  act(() => {
    fireEvent.keyDown(target, { key });
  });
}

function Listed() {
  const registry = useStaffShortcuts();
  return (
    <ul aria-label="Registered">
      {registry?.shortcuts.map((shortcut) => (
        <li key={shortcut.id}>{`${shortcut.keys}: ${shortcut.label}`}</li>
      ))}
    </ul>
  );
}

describe("list keyboard", () => {
  it("moves into the rows with J and K and opens the focused row with Enter", () => {
    const onRowOpen = vi.fn();
    render(
      <StaffShortcutsProvider>
        <DataTable
          label="Payments"
          columns={columns}
          data={data}
          getRowId={(r) => r.id}
          onRowOpen={onRowOpen}
        />
        <Listed />
      </StaffShortcutsProvider>,
    );
    const rows = screen.getAllByRole("row").slice(1);
    // jsdom lays nothing out, so mark the table layout as visible.
    for (const wrapper of document.querySelectorAll("table")) {
      Object.defineProperty(wrapper.parentElement as HTMLElement, "offsetParent", {
        configurable: true,
        get: () => document.body,
      });
    }
    press("j");
    expect(rows[0]).toHaveFocus();
    press("j", rows[0] as HTMLElement);
    expect(rows[1]).toHaveFocus();
    press("k", rows[1] as HTMLElement);
    expect(rows[0]).toHaveFocus();
    press("Enter", rows[0] as HTMLElement);
    expect(onRowOpen).toHaveBeenCalledWith(data[0]);
    expect(screen.getByText("enter: Open the focused row")).toBeInTheDocument();
    expect(screen.getByText("escape: Close the open panel or menu")).toBeInTheDocument();
  });

  it("never lets a listed-only key act from the page", () => {
    const onRowOpen = vi.fn();
    render(
      <StaffShortcutsProvider>
        <DataTable
          label="Payments"
          columns={columns}
          data={data}
          getRowId={(r) => r.id}
          onRowOpen={onRowOpen}
        />
      </StaffShortcutsProvider>,
    );
    press("Enter");
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  it("opens the filter sheet with F", () => {
    render(
      <StaffShortcutsProvider>
        <FilterSheet
          sections={[
            {
              kind: "radio",
              id: "xero",
              label: "Xero invoice",
              options: [{ value: "linked", label: "Linked" }],
              value: "",
            },
          ]}
          onApply={() => {}}
        />
      </StaffShortcutsProvider>,
    );
    expect(screen.queryByTestId("sheet")).toBeNull();
    press("f");
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
  });
});
