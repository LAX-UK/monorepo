import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataColumn } from "./types.js";

vi.mock("@auction/ui/components/dropdown-menu", () =>
  import("../test/radix-stubs.js").then((m) => m.dropdownMenu),
);
vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { ColumnsMenu, useColumnVisibility, visibleColumns } = await import("./columns-menu.js");
const { RowActions, rowActionsColumn } = await import("./row-actions.js");
const { fitViewTabs } = await import("./toolbar.js");

type Row = { id: string };
const columns: DataColumn<Row>[] = [
  { id: "lot", header: "Lot", cell: () => null },
  { id: "status", header: "Status", cell: () => null },
  { id: "xero", header: "Xero invoice", cell: () => null },
];

describe("useColumnVisibility", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts from the list's defaults, remembers changes and resets", () => {
    const { result, unmount } = renderHook(() => useColumnVisibility("payments", ["xero"]));
    expect([...result.current.hidden]).toEqual(["xero"]);
    expect(result.current.changed).toBe(false);
    act(() => result.current.setHidden("status", true));
    expect(result.current.changed).toBe(true);
    unmount();
    const again = renderHook(() => useColumnVisibility("payments", ["xero"]));
    expect([...again.result.current.hidden].sort()).toEqual(["status", "xero"]);
    act(() => again.result.current.reset());
    expect([...again.result.current.hidden]).toEqual(["xero"]);
    expect(window.localStorage.getItem("staff.columns.payments")).toBeNull();
  });

  it("never hides a locked column", () => {
    const shown = visibleColumns(columns, new Set(["lot", "xero"]), ["lot"]);
    expect(shown.map((column) => column.id)).toEqual(["lot", "status"]);
  });
});

describe("ColumnsMenu", () => {
  beforeEach(() => window.localStorage.clear());

  it("lists every column but the identifier, and offers reset once changed", () => {
    function Harness() {
      const visibility = useColumnVisibility("lots");
      return <ColumnsMenu columns={columns} visibility={visibility} />;
    }
    render(<Harness />);
    const items = screen.getAllByRole("menuitemcheckbox");
    expect(items.map((item) => item.textContent)).toEqual(["Status", "Xero invoice"]);
    expect(screen.queryByRole("menuitem", { name: "Reset columns" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Status" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Status" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset columns" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Status" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("RowActions", () => {
  it("is a visible menu named for its row, with destructive actions last", () => {
    const refund = vi.fn();
    render(
      <RowActions
        label="Actions for payment Golden Hour"
        actions={[
          { id: "refund", label: "Refund £4,140.00", tone: "danger", onSelect: refund },
          { id: "open", label: "Open payment", onSelect: () => {} },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Actions for payment Golden Hour" }),
    ).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Open payment", "Refund £4,140.00"]);
    fireEvent.click(items[1] as HTMLElement);
    expect(refund).toHaveBeenCalled();
  });

  it("makes a 56px last column whose header is for screen readers only", () => {
    const column = rowActionsColumn<Row>({
      actions: () => [],
      label: (row) => `Actions for ${row.id}`,
    });
    expect(column).toMatchObject({
      id: "actions",
      headerHidden: true,
      width: "56px",
      mobile: "actions",
    });
  });
});

describe("fitViewTabs", () => {
  it("shows every tab when they fit, or before anything is measured", () => {
    expect(fitViewTabs([80, 80, 80], 600, 0).overflow).toEqual([]);
    expect(fitViewTabs([0, 0, 0], 0, 2).overflow).toEqual([]);
  });

  it("moves the tabs that do not fit into More and keeps the active one visible", () => {
    const widths = [100, 100, 100, 100, 100, 100];
    const fit = fitViewTabs(widths, 400, 5);
    expect(fit.visible).toContain(5);
    expect(fit.visible.length + fit.overflow.length).toBe(6);
    expect(fit.overflow.length).toBeGreaterThan(0);
    expect(fit.visible).toEqual([...fit.visible].sort((a, b) => a - b));
  });

  it("reserves exactly the measured More width, so one more tab fits when the button is narrow", () => {
    const widths = [100, 100, 100, 100];
    // 3 tabs (306 with gaps) plus a 60px button and its gap fit in 370; an 88px reservation does not.
    expect(fitViewTabs(widths, 370, 0, 2, 60).visible).toEqual([0, 1, 2]);
    expect(fitViewTabs(widths, 370, 0, 2, 88).visible).toEqual([0, 1]);
  });

  it("keeps the active tab visible whatever the More width", () => {
    const fit = fitViewTabs([100, 100, 100, 100], 370, 3, 2, 60);
    expect(fit.visible).toContain(3);
    expect(fit.overflow.length).toBeGreaterThan(0);
  });
});
