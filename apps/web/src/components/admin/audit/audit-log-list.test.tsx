import type { AuditLogRowModel } from "@/lib/admin/audit/audit-log.vm";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuditLogList, type AuditLogListProps } from "./audit-log-list";

// Radix sheets, popovers, menus and command lists keep positioning and focus loops running in
// jsdom; these stand-ins keep the open/close contract so the list's own behaviour is tested.
vi.mock("@auction/ui/components/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetClose: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@auction/ui/components/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: () => null,
    DropdownMenuItem: Pass,
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
  };
});
vi.mock("@auction/ui/components/command", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Command: Pass,
    CommandInput: Pass,
    CommandList: Pass,
    CommandEmpty: Pass,
    CommandGroup: Pass,
    CommandItem: Pass,
  };
});
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/actions/admin-audit-actors", () => ({
  searchAuditActorsAction: vi.fn().mockResolvedValue({ ok: true, data: { actors: [] } }),
}));

const row: AuditLogRowModel = {
  id: "1",
  at: "2026-10-24T09:30:00.000Z",
  actor: { name: "Ada Staff", email: "ada@example.com", kind: "staff" },
  actorUserId: "staff-1",
  action: "Withdrawal declined",
  actionCode: "lot.withdrawal_declined",
  tone: "danger",
  entity: {
    type: "lot",
    typeLabel: "Lot",
    id: "0b7e4a52-8b3c",
    shortId: "0b7e4a52",
    href: "/admin/lots/0b7e4a52-8b3c",
  },
  summary: "Status: consigned → withdrawn",
  detail: {
    changes: [
      {
        label: "Status",
        before: { text: "consigned", hidden: false },
        after: { text: "withdrawn", hidden: false },
      },
    ],
    facts: [{ label: "Note", value: { text: null, hidden: true } }],
  },
};

const filters = {
  view: null,
  q: "",
  actor: "",
  actorLabel: "",
  entity: "",
  action: "",
  from: "",
  to: "",
  offset: 0,
};

function props(overrides: Partial<AuditLogListProps> = {}): AuditLogListProps {
  return {
    rows: [row],
    search: {},
    filters,
    chips: [],
    clearAllHref: "/admin/audit",
    actions: [{ value: "lot.withdrawal_declined", label: "Withdrawal declined" }],
    pagination: { summary: "1–1 of 1 events", prevHref: null, nextHref: null },
    loadError: null,
    filtered: false,
    ...overrides,
  };
}

describe("AuditLogList", () => {
  it("shows actor name and email, the action sentence and a link to the record", () => {
    render(<AuditLogList {...props()} />);
    const grid = screen.getByRole("grid", { name: "Audit log" });

    expect(within(grid).getByText("Ada Staff")).toBeInTheDocument();
    expect(within(grid).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(grid).getByText("Withdrawal declined")).toBeInTheDocument();
    expect(within(grid).getByRole("link", { name: "0b7e4a52…" })).toHaveAttribute(
      "href",
      "/admin/lots/0b7e4a52-8b3c",
    );
  });

  it("offers the four views as links and marks the current one", () => {
    render(<AuditLogList {...props({ filters: { ...filters, view: "finance" } })} />);
    const views = screen.getByRole("navigation", { name: "Views" });

    expect(
      within(views)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["All", "Finance", "Catalogue", "People"]);
    expect(within(views).getByRole("link", { name: "Finance" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(views).getByRole("link", { name: "People" })).toHaveAttribute(
      "href",
      "/admin/audit?view=people",
    );
  });

  it("opens the full event, with the change shown before and after", () => {
    render(<AuditLogList {...props()} />);

    fireEvent.click(within(screen.getByRole("grid", { name: "Audit log" })).getByText("Ada Staff"));

    const panel = screen.getByTestId("sheet");
    expect(within(panel).getByText("What changed")).toBeInTheDocument();
    expect(within(panel).getByText("consigned")).toBeInTheDocument();
    expect(within(panel).getByText("withdrawn")).toBeInTheDocument();
    expect(within(panel).getByText("Hidden for your role")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open lot" })).toHaveAttribute(
      "href",
      "/admin/lots/0b7e4a52-8b3c",
    );
  });

  it("says nothing has been recorded when the log is empty and unfiltered", () => {
    render(<AuditLogList {...props({ rows: [], pagination: null })} />);
    expect(screen.getByText("No events recorded yet")).toBeInTheDocument();
  });

  it("offers to clear filters when they match nothing", () => {
    render(<AuditLogList {...props({ rows: [], pagination: null, filtered: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("No events match")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/admin/audit", { scroll: false });
  });

  it("shows a retryable error", () => {
    render(
      <AuditLogList
        {...props({ rows: [], pagination: null, loadError: "The audit log could not be loaded." })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The audit log did not load");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lists applied filters as removable chips", () => {
    render(
      <AuditLogList
        {...props({ chips: [{ id: "q", label: "Search: ada", clearHref: "/admin/audit" }] })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Search: ada" }));
    expect(push).toHaveBeenCalledWith("/admin/audit", { scroll: false });
  });
});
