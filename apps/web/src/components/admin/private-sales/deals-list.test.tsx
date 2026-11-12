import { parseDealsSearch } from "@/lib/admin/private-sales/private-sales-search";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listItem } from "./deal.fixture";
import { DealsList, type DealsListProps } from "./deals-list";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/private-sales",
  useSearchParams: () => new URLSearchParams(),
}));

const COUNTS = {
  active: 3,
  needs_me: 1,
  waiting_on_checks: 1,
  payment_due: 1,
  needs_attention: 1,
  settled: 0,
  cancelled: 0,
  all: 3,
};

function renderList(patch: Partial<DealsListProps> = {}) {
  const props: DealsListProps = {
    page: {
      items: [
        listItem(),
        listItem({
          id: "deal-13",
          reference: "PS-0013",
          workTitle: "Low tide at Maldon",
          workReference: "C-1050",
          stage: "proposed",
          buyerName: null,
          priceMinor: null,
          offerExpiresAt: null,
        }),
        listItem({
          id: "deal-14",
          reference: "PS-0014",
          workTitle: "Red study",
          stage: "invoiced",
          paymentDueAt: "2026-11-19T17:00:00.000Z",
        }),
      ],
      nextCursor: null,
      counts: COUNTS,
      urgentFollowUps: 0,
    },
    search: {},
    filters: parseDealsSearch({}),
    pagination: { summary: "3 deals", prevHref: null, nextHref: null },
    loadError: null,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <DealsList {...props} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DealsList", () => {
  it("lists each deal with its work, both sides, price, stage and next step", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Private sales" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    const first = rows.find((row) => within(row).queryByText("Harbour at dusk"));
    expect(first).toBeTruthy();
    expect(within(first as HTMLElement).getByText("PS-0012 · C-1042")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("£48,000.00")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("Agree the price")).toBeInTheDocument();
  });

  it("asks to name a buyer where there is none, and leaves the price empty rather than £0.00", () => {
    renderList();
    const row = screen.getAllByRole("row").find((r) => within(r).queryByText("Low tide at Maldon"));
    expect(within(row as HTMLElement).getByText("Name the buyer")).toBeInTheDocument();
    expect(screen.queryByText("£0.00")).toBeNull();
  });

  it("shows the date the deal is waiting for", () => {
    renderList();
    expect(screen.getAllByText(/Payment due Thu 19 Nov/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Offer expires Thu 12 Nov/).length).toBeGreaterThan(0);
  });

  it("offers every view with its count, on the active one", () => {
    renderList();
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Active/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: /Waiting on checks/ })).toHaveAttribute(
      "href",
      "/admin/private-sales?view=waiting_on_checks",
    );
    expect(within(tabs).getByRole("link", { name: /Needs me/ })).toHaveTextContent("1");
  });

  it("says in the row when a settled deal's artwork wasn't marked sold, and when it may be a double sale", () => {
    renderList({
      page: {
        items: [
          listItem({
            id: "d-s1",
            reference: "PS-0021",
            workTitle: "Quiet harbour",
            stage: "settled",
            settlementFollowUp: "normal",
          }),
          listItem({
            id: "d-s2",
            reference: "PS-0022",
            workTitle: "Red study II",
            stage: "settled",
            settlementFollowUp: "urgent",
          }),
          listItem({ id: "d-s3", reference: "PS-0023", workTitle: "Clear one", stage: "settled" }),
        ],
        nextCursor: null,
        counts: COUNTS,
        urgentFollowUps: 1,
      },
    });
    const rowOf = (title: string) =>
      screen.getAllByRole("row").find((r) => within(r).queryByText(title)) as HTMLElement;
    expect(within(rowOf("Quiet harbour")).getByText("Not marked sold")).toBeInTheDocument();
    expect(within(rowOf("Red study II")).getByText("Possible double sale")).toBeInTheDocument();
    expect(within(rowOf("Clear one")).queryByText(/marked sold|double sale/)).toBeNull();
  });

  it("offers the needs attention view with its count", () => {
    renderList({ filters: parseDealsSearch({ view: "needs_attention" }) });
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Needs attention/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: /Needs attention/ })).toHaveTextContent("1");
  });

  it("opens a deal from its row", () => {
    renderList();
    for (const link of screen.getAllByRole("link", { name: "Harbour at dusk" })) {
      expect(link).toHaveAttribute("href", "/admin/private-sales/PS-0012");
    }
  });

  it("says what an empty view is for, and offers no export or total", () => {
    renderList({
      page: { items: [], nextCursor: null, counts: COUNTS, urgentFollowUps: 0 },
      filters: parseDealsSearch({ view: "payment_due" }),
      pagination: null,
    });
    expect(screen.getByText("No payment is due")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
  });

  it("says the list could not be loaded, with a way to try again", () => {
    renderList({
      page: null,
      pagination: null,
      loadError: "The Bid API didn't answer. Deals are safe; try again in a moment.",
    });
    expect(screen.getByText("Private sales couldn't be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again|retry/i }));
    expect(push).toHaveBeenCalled();
  });
});
