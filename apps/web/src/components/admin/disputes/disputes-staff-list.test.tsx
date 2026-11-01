import { toDisputesStaffRows } from "@/lib/admin/finance/disputes-staff-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import type { DisputeDeskCaseSummary } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DisputesStaffList, type DisputesStaffListProps } from "./disputes-staff-list";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/disputes",
  useSearchParams: () => new URLSearchParams(),
}));

const now = new Date("2026-11-01T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

const base: DisputeDeskCaseSummary = {
  id: "case-1",
  stripeDisputeId: "dp_1",
  status: "needs_response",
  allocationState: "allocated",
  awaitingAllocation: false,
  amountPence: 480_000,
  currency: "gbp",
  reason: "product_unacceptable",
  dueBy: inDays(2),
  evidenceSubmitted: false,
  openedAt: "2026-10-30T09:14:00.000Z",
  closedAt: null,
  invoiceCount: 1,
  lotTitle: "Downs after rain",
  buyerId: "u1",
  buyerLabel: "Tom Ashworth",
  sellerNames: ["Northbank Gallery"],
};

const rows = toDisputesStaffRows(
  [
    base,
    {
      ...base,
      id: "case-2",
      stripeDisputeId: "dp_2",
      reason: "fraudulent",
      allocationState: "needs_allocation",
      awaitingAllocation: true,
      invoiceCount: 3,
      lotTitle: null,
      dueBy: inDays(5),
      amountPence: 1_420_000,
      buyerLabel: "Hartley Collection Ltd",
    },
    {
      ...base,
      id: "case-3",
      stripeDisputeId: "dp_3",
      reason: "product_not_received",
      allocationState: "needs_allocation",
      awaitingAllocation: true,
      invoiceCount: 0,
      lotTitle: null,
      buyerId: null,
      buyerLabel: null,
      dueBy: "2026-11-12T23:59:00.000Z",
      amountPence: 235_000,
    },
  ],
  now,
);

const counts = { needs_allocation: 2, open: 3, under_review: 0, closed: 0, all: 3 };

function renderList(patch: Partial<DisputesStaffListProps> = {}) {
  const props: DisputesStaffListProps = {
    search: {},
    view: "open",
    rows,
    counts,
    pageSize: 50,
    pagination: { summary: "1–3 of 3 disputes", prevHref: null, nextHref: null },
    filtered: false,
    loadError: null,
    canOpenClient: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <DisputesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("DisputesStaffList", () => {
  it("lists each case with its allocation state, deadline and amount", () => {
    renderList();
    for (const text of [
      "Downs after rain",
      "3 lots on one payment",
      "No matching payment",
      "Needs allocation",
      "No payment found",
      "Allocated",
      "2 days left",
      "5 days left",
      "Respond by 12 Nov",
      "£14,200.00",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("opens a case from its title", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "Downs after rain" })[0]).toHaveAttribute(
      "href",
      "/admin/disputes/case-1",
    );
  });

  it("shows an unknown buyer as such and links the others only with access", () => {
    renderList({ canOpenClient: false });
    expect(screen.getAllByText("Unknown buyer").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Tom Ashworth" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Tom Ashworth").length).toBeGreaterThan(0);
  });

  it("links buyers for someone who can open client pages", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "Tom Ashworth" })[0]).toHaveAttribute(
      "href",
      "/admin/clients/u1",
    );
  });

  it("puts a count on the queues that are work waiting", () => {
    renderList();
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Needs allocation/ })).toHaveTextContent("2");
    expect(within(tabs).getByRole("link", { name: /Open/ })).toHaveTextContent("3");
    expect(within(tabs).getByRole("link", { name: /Closed/ })).not.toHaveTextContent(/\d/);
  });

  it("explains an empty queue and offers the closed cases", () => {
    renderList({ rows: [], pagination: null, counts: { ...counts, open: 0 } });
    expect(screen.getByText("No open disputes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View closed cases" })).toHaveAttribute(
      "href",
      "/admin/disputes?view=closed",
    );
  });

  it("says nothing needs allocating in that queue", () => {
    renderList({ view: "needs_allocation", rows: [], pagination: null });
    expect(screen.getByText("Nothing needs allocating")).toBeInTheDocument();
  });

  it("says nothing matched a search, and offers to clear it", () => {
    renderList({
      rows: [],
      pagination: null,
      filtered: true,
      search: { q: "Hartley", reason: "fraudulent" },
    });
    expect(screen.getByText("No disputes match")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Reason: Fraudulent")).toBeInTheDocument();
  });

  it("shows a failure in place of the rows, with a way to try again", () => {
    renderList({
      rows: [],
      pagination: null,
      loadError: "We could not reach the disputes service.",
    });
    expect(screen.getByText("Disputes couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByText("We could not reach the disputes service.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
