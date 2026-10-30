import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchChipLabel } from "../data/toolbar.js";
import type { DataColumn } from "../data/types.js";

vi.mock("@auction/ui/components/dropdown-menu", () =>
  import("../test/radix-stubs.js").then((m) => m.dropdownMenu),
);
vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);
vi.mock("@auction/ui/components/sheet", () =>
  import("../test/radix-stubs.js").then((m) => m.sheet),
);
vi.mock("@auction/ui/components/dialog", () =>
  import("../test/radix-stubs.js").then((m) => m.dialog),
);

const { ListPage, NO_RESULTS_DESCRIPTION } = await import("./list-page.js");
const { DetailColumns, DetailError, DetailPage, DetailPageSkeleton } = await import(
  "./detail-page.js"
);
const { PlainLink } = await import("@auction/ui/lax");
const { StaffButton } = await import("../primitives/button.js");

type Payment = { id: string; lot: string; amount: string };

const columns: DataColumn<Payment>[] = [
  { id: "lot", header: "Lot", cell: (row) => row.lot, sortable: true, sortValue: (r) => r.lot },
  { id: "amount", header: "Amount", numeric: true, cell: (row) => row.amount },
];
const rows: Payment[] = [
  { id: "p1", lot: "Golden Hour", amount: "£4,140.00" },
  { id: "p2", lot: "Blue Study", amount: "£800.00" },
];

function page(overrides: Partial<React.ComponentProps<typeof ListPage<Payment>>> = {}) {
  return (
    <ListPage<Payment>
      title="Payments"
      description="Capture, refund and reconcile buyer payments."
      Link={PlainLink}
      listKey="test.payments"
      secondaryActions={<StaffButton size="sm">Export</StaffButton>}
      primaryAction={<StaffButton variant="primary">New payment link</StaffButton>}
      filtered={false}
      empty={{ title: "No payments yet", description: "Payments appear after a sale." }}
      noResults={{ noun: "payments" }}
      table={{
        columns,
        data: rows,
        getRowId: (row) => row.id,
        defaultSort: { columnId: "lot", direction: "asc" },
        rowActions: {
          label: (row) => `Actions for ${row.lot}`,
          actions: (row) => [
            { id: "open", label: "Open payment", onSelect: () => {} },
            { id: "refund", label: `Refund ${row.amount}`, tone: "danger", onSelect: () => {} },
          ],
        },
      }}
      {...overrides}
    />
  );
}

describe("ListPage", () => {
  beforeEach(() => window.localStorage.clear());

  it("lays the page out in the fixed order with a single heading", () => {
    render(
      page({
        attention: [{ id: "mr", count: 10, label: "payments need manual review", href: "/p?mr=1" }],
        metrics: {
          label: "Payments summary",
          period: "Matching the current filters",
          items: [{ id: "v", label: "Volume", value: "£4,940.00" }],
        },
        search: <input aria-label="Search payments" />,
        filters: <StaffButton size="sm">Filter</StaffButton>,
        activeFilters: [{ id: "q", label: "“golden”", onRemove: () => {} }],
        onClearFilters: () => {},
        pagination: { summary: "1–2 of 2", prevHref: null, nextHref: null },
      }),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const order = [
      screen.getByRole("heading", { level: 1, name: "Payments" }),
      screen.getByRole("region", { name: "Needs attention" }),
      screen.getByRole("region", { name: "Payments summary" }),
      screen.getByRole("textbox", { name: "Search payments" }),
      screen.getByRole("list", { name: "Applied filters" }),
      screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement,
      screen.getByRole("navigation", { name: "Pagination" }),
    ];
    for (let index = 1; index < order.length; index += 1) {
      const previous = order[index - 1] as HTMLElement;
      const next = order[index] as HTMLElement;
      expect(
        previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Display" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Columns" })).toBeNull();
  });

  it("never leaves a band holding only a control or two", () => {
    const tabsRow = () =>
      screen.getByRole("navigation", { name: "Views" }).parentElement?.parentElement as HTMLElement;
    const display = () => screen.getByRole("button", { name: "Display" });

    // Tabs, no search: Filter and Display join the tabs row.
    const first = render(
      page({
        resultCount: "2 payments",
        views: <nav aria-label="Views">tabs</nav>,
        filters: <StaffButton size="sm">Filter</StaffButton>,
      }),
    );
    expect(tabsRow()).toContainElement(display());
    expect(tabsRow()).toContainElement(screen.getByRole("button", { name: "Filter" }));
    expect(screen.queryByText("2 payments")).toBeNull();
    first.unmount();

    // Tabs and search: the search row holds the controls.
    const second = render(
      page({
        views: <nav aria-label="Views">tabs</nav>,
        search: <input aria-label="Search payments" />,
      }),
    );
    expect(tabsRow()).not.toContainElement(display());
    second.unmount();

    // No tabs, no search: one slim row, the count on the left and Display on the right.
    render(page({ resultCount: "2 payments" }));
    expect(screen.getByText("2 payments").parentElement).toContainElement(display());
  });

  it("puts columns, density, page size and reset in one Display menu", () => {
    const onPageSize = vi.fn();
    render(page({ pageSize: { value: 50, onChange: onPageSize } }));
    const reset = () => screen.getByRole("menuitem", { name: "Reset to default" });
    expect(reset()).toHaveAttribute("aria-disabled", "true");
    const table = () => screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement;
    expect(table().querySelector("tbody tr")).toHaveClass("h-9");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Comfortable" }));
    expect(table().querySelector("tbody tr")).toHaveClass("h-11");
    expect(screen.getByRole("menuitemradio", { name: "50" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: "100" }));
    expect(onPageSize).toHaveBeenCalledWith(100);
    fireEvent.click(reset());
    expect(table().querySelector("tbody tr")).toHaveClass("h-9");
  });

  it("shows one muted dash for an empty cell", () => {
    render(
      page({
        table: {
          columns,
          data: [{ id: "p3", lot: "Night Ferry", amount: "" }],
          getRowId: (row) => row.id,
        },
      }),
    );
    const table = screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement;
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(within(table).getByText("None")).toHaveClass("sr-only");
  });

  it("puts Export first among the header actions", () => {
    render(page({ exportAction: <StaffButton size="sm">Export CSV</StaffButton> }));
    const exportButton = screen.getByRole("button", { name: "Export CSV" });
    const other = screen.getByRole("button", { name: "Export" });
    expect(
      exportButton.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("gives every row a visible actions menu and keeps money actions in it", () => {
    render(page());
    const table = screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement;
    expect(within(table).getByRole("button", { name: "Actions for Golden Hour" })).toBeVisible();
    expect(within(table).queryByRole("button", { name: /Refund/ })).not.toBeInTheDocument();
    expect(within(table).getAllByRole("menuitem", { name: /Refund/ })).toHaveLength(2);
    expect(within(table).getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("hides a column from the Display menu and remembers it", () => {
    const { unmount } = render(page());
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Amount" }));
    const table = () => screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement;
    expect(within(table()).queryByRole("columnheader", { name: "Amount" })).toBeNull();
    unmount();
    render(page());
    expect(within(table()).queryByRole("columnheader", { name: "Amount" })).toBeNull();
  });

  it("shows skeleton rows on first load", () => {
    render(page({ loading: true, table: { columns, data: [], getRowId: (row) => row.id } }));
    const table = screen.getAllByRole("table", { name: "Payments" })[0] as HTMLElement;
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(8);
  });

  it("tells empty apart from no results, and offers to clear filters", () => {
    const clear = vi.fn();
    const { rerender } = render(page({ table: { columns, data: [], getRowId: (r) => r.id } }));
    expect(screen.getByRole("heading", { name: "No payments yet" })).toBeInTheDocument();
    rerender(
      page({
        filtered: true,
        onClearFilters: clear,
        activeFilters: [{ id: "q", label: searchChipLabel("golden"), onRemove: () => {} }],
        pagination: { summary: "0 of 0", prevHref: null, nextHref: null },
        table: { columns, data: [], getRowId: (r) => r.id },
      }),
    );
    expect(screen.getByRole("heading", { name: "No payments match" })).toBeInTheDocument();
    expect(screen.getByText(NO_RESULTS_DESCRIPTION)).toBeInTheDocument();
    // The search stays visible as a chip, and there is no page count over nothing.
    expect(screen.getByText("Search: golden")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(clear).toHaveBeenCalled();
  });

  it("offers the creating action once, in the empty state, and returns it to the header with rows", () => {
    const create = <StaffButton variant="primary">New payment link</StaffButton>;
    const emptyTable = { columns, data: [], getRowId: (r: Payment) => r.id };
    const { rerender } = render(
      page({
        primaryAction: create,
        empty: { title: "No payments yet", action: create },
        table: emptyTable,
      }),
    );
    expect(screen.getAllByRole("button", { name: "New payment link" })).toHaveLength(1);
    expect(
      within(
        screen
          .getByRole("heading", { name: "No payments yet" })
          .closest("[data-staff-state]") as HTMLElement,
      ).getByRole("button", { name: "New payment link" }),
    ).toBeInTheDocument();
    rerender(
      page({
        primaryAction: create,
        empty: { title: "No payments yet", action: create },
        filtered: true,
        table: emptyTable,
      }),
    );
    expect(screen.getAllByRole("button", { name: "New payment link" })).toHaveLength(1);
    rerender(page({ primaryAction: create, empty: { title: "No payments yet", action: create } }));
    expect(screen.getAllByRole("button", { name: "New payment link" })).toHaveLength(1);
  });

  it("replaces the rows with an error and a retry, keeping the frame", () => {
    const retry = vi.fn();
    render(
      page({
        error: { description: "The payments service did not answer.", onRetry: retry },
        metrics: { label: "Payments summary", period: "Today", items: [] },
        search: <input aria-label="Search payments" />,
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Payments did not load");
    expect(screen.getByRole("textbox", { name: "Search payments" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Payments summary" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });

  it("says who can open the page when access is denied", () => {
    render(page({ access: "denied", requiredRole: "Finance" }));
    expect(
      screen.getByRole("heading", { name: "You don’t have access to Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/open to the Finance role/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });

  it("marks read-only access and drops the primary action and selection", () => {
    render(
      page({
        access: "read-only",
        roleLabel: "Finance",
        table: {
          columns,
          data: rows,
          getRowId: (row) => row.id,
          selectedIds: new Set(),
          onSelectedIdsChange: () => {},
          bulkActions: () => null,
        },
      }),
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New payment link" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("DetailPage", () => {
  it("orders breadcrumbs, title and status, summary, then main beside the rail", () => {
    render(
      <DetailPage
        breadcrumbs={<nav aria-label="Breadcrumb">Payments</nav>}
        pager={<span>3 of 50</span>}
        title="Golden Hour"
        status={<span>Captured</span>}
        primaryAction={<StaffButton variant="primary">Refund £4,140.00</StaffButton>}
        summary={[{ label: "Amount", value: "£4,140.00", numeric: true }]}
        rail={<section aria-label="Timeline">Events</section>}
      >
        <section aria-label="Line items">Items</section>
      </DetailPage>,
    );
    const order = [
      screen.getByRole("navigation", { name: "Breadcrumb" }),
      screen.getByRole("heading", { level: 1, name: "Golden Hour" }),
      screen.getByRole("region", { name: "Summary" }),
      screen.getByRole("region", { name: "Line items" }),
      screen.getByRole("complementary", { name: "Activity" }),
    ];
    for (let index = 1; index < order.length; index += 1) {
      const previous = order[index - 1] as HTMLElement;
      const next = order[index] as HTMLElement;
      expect(
        previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByText("3 of 50")).toBeInTheDocument();
  });

  it("covers read-only, loading, error and denied", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <DetailPage
        title="Golden Hour"
        access="read-only"
        roleLabel="Finance"
        primaryAction={<StaffButton variant="primary">Refund</StaffButton>}
      />,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();

    rerender(<DetailPage title="Golden Hour" loading rail={<div />} />);
    expect(screen.getByRole("heading", { level: 1 }).closest("[aria-busy]")).toBeTruthy();

    rerender(
      <DetailPage title="Golden Hour" error={{ description: "Timed out.", onRetry: retry }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();

    rerender(<DetailPage title="Payment" access="denied" resource="Payments" />);
    expect(
      screen.getByRole("heading", { name: "You don’t have access to Payments" }),
    ).toBeInTheDocument();
  });

  it("lays a routed tab's own main column beside its rail, and drops the rail when empty", () => {
    const { rerender } = render(
      <DetailColumns rail={<p>Events</p>} railLabel="Lot activity">
        <section aria-label="Commercial">Prices</section>
      </DetailColumns>,
    );
    expect(screen.getByRole("complementary", { name: "Lot activity" })).toHaveTextContent("Events");
    rerender(
      <DetailColumns>
        <section aria-label="Commercial">Prices</section>
      </DetailColumns>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("shows a tab's loading body with or without the summary card", () => {
    const { container, rerender } = render(<DetailPageSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    const without = container.querySelectorAll(".rounded-staff-lg").length;
    rerender(<DetailPageSkeleton withSummary />);
    expect(container.querySelectorAll(".rounded-staff-lg").length).toBe(without + 1);
  });

  it("keeps a tab's failure in place with a retry", () => {
    const retry = vi.fn();
    render(<DetailError description="The bids did not load." onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This section did not load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
