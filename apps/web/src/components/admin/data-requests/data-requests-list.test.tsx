import {
  CLOSED_ROWS,
  OPEN_ROWS,
  SUMMARY,
  closedOnTime,
  failedDownload,
  overdueManual,
  waitingManual,
} from "@/lib/admin/data-requests/data-request.fixture";
import { parseDataRequestsSearch } from "@/lib/admin/data-requests/data-requests-search";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataRequestsList, type DataRequestsListProps } from "./data-requests-list";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/compliance/data-requests",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-data-requests", () => ({
  logDataRequestAction: vi.fn(),
  findDataRequestAccountAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

function renderList(patch: Partial<DataRequestsListProps> = {}) {
  const props: DataRequestsListProps = {
    list: { items: OPEN_ROWS, nextCursor: null },
    summary: SUMMARY,
    search: {},
    filters: parseDataRequestsSearch({}),
    chips: [],
    pagination: { summary: "7 requests", prevHref: null, nextHref: null },
    loadError: null,
    filtered: false,
    today: "2026-11-02",
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <DataRequestsList {...props} />
    </StaffTooltipProvider>,
  );
}

function openRowMenu(reference: string) {
  const trigger = screen.getAllByRole("button", {
    name: new RegExp(`^Actions for ${reference}`),
  })[0];
  fireEvent.keyDown(trigger as HTMLElement, { key: "Enter" });
  return within(screen.getByRole("menu"));
}

beforeEach(() => vi.clearAllMocks());

describe("DataRequestsList: rows", () => {
  it("shows masked emails with the reference under them, never a full address", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Data requests" })).toBeInTheDocument();
    expect(screen.getAllByText("m•••••@o•••••.co.uk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DR-0014 · No account").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/margaret\.osei/);
  });

  it("links each person to the request, carrying the list so J and K stay in it", () => {
    renderList();
    const link = screen.getAllByRole("link", { name: "m•••••@o•••••.co.uk" })[0];
    expect(link).toHaveAttribute(
      "href",
      "/admin/compliance/data-requests/DR-0012?view=open&sort=due",
    );
  });

  it("shows how the deadline stands, with a badge for a missed or close date", () => {
    renderList();
    expect(screen.getAllByText("1 day overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7 days left").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Starts when ID arrives").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Extended · 46 days left").length).toBeGreaterThan(0);
  });

  it("shows the product dots and counts", () => {
    renderList();
    expect(screen.getAllByText("2 of 3").length).toBeGreaterThan(0);
  });

  it("has no checkboxes or bulk actions: each request is its own case", () => {
    renderList();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("names the closed outcome in the Closed view", () => {
    renderList({
      list: { items: CLOSED_ROWS, nextCursor: null },
      filters: parseDataRequestsSearch({ view: "closed" }),
    });
    expect(screen.getAllByText("Closed · Copy sent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On time").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 days late").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Continued as DR-0013").length).toBeGreaterThan(0);
  });
});

describe("DataRequestsList: header and strips", () => {
  it("offers Log a manual request as the one primary action", () => {
    renderList();
    expect(screen.getByRole("button", { name: "Log a manual request" })).toBeInTheDocument();
  });

  it("opens the Log dialog", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Log a manual request" }));
    expect(screen.getByRole("dialog", { name: "Log a manual request" })).toBeInTheDocument();
  });

  it("puts what needs attention above the table, missed deadlines first", () => {
    renderList();
    const strip = screen.getByRole("region", { name: "Needs attention" });
    const lines = within(strip).getAllByRole("link");
    expect(lines[0]).toHaveTextContent("1 request is past its legal due date");
    expect(lines[0]).toHaveAttribute("href", "/admin/compliance/data-requests?view=overdue");
    expect(lines[1]).toHaveTextContent("1 request is due within 7 days");
  });

  it("counts the views that need action", () => {
    renderList();
    const tabs = screen.getByRole("navigation", { name: /views/i });
    for (const label of ["Open", "Overdue", "Waiting for ID", "Closed", "All"]) {
      expect(within(tabs).getByText(label)).toBeInTheDocument();
    }
  });

  it("states the answered-on-time figure", () => {
    renderList();
    expect(screen.getByText("41 of 42")).toBeInTheDocument();
  });
});

describe("DataRequestsList: row menu", () => {
  it("offers Open, Copy reference, then the actions the request's state allows", () => {
    renderList();
    const menu = openRowMenu("DR-0012");
    expect(menu.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Copy reference" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Close with outcome…" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Continue manually…" })).not.toBeInTheDocument();
  });

  it("keeps Extend in the menu, disabled, once the original due date has passed", () => {
    renderList();
    const extend = openRowMenu(overdueManual.reference).getByRole("menuitem", { name: /Extend…/ });
    expect(extend).toHaveAttribute("aria-disabled", "true");
    expect(extend).toHaveTextContent("The original due date, 1 Nov 2026, has passed.");
  });

  it("offers Continue manually on a failed download only", () => {
    renderList();
    const menu = openRowMenu(failedDownload.reference);
    expect(menu.getByRole("menuitem", { name: "Continue manually…" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Close with outcome…" })).not.toBeInTheDocument();
  });

  it("offers nothing past Open and Copy on a closed request", () => {
    renderList({
      list: { items: [closedOnTime], nextCursor: null },
      filters: parseDataRequestsSearch({ view: "closed" }),
    });
    const menu = openRowMenu(closedOnTime.reference);
    expect(menu.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("disables Extend for a request waiting for ID", () => {
    renderList({ list: { items: [waitingManual], nextCursor: null } });
    const extend = openRowMenu(waitingManual.reference).getByRole("menuitem", { name: /Extend…/ });
    expect(extend).toHaveAttribute("aria-disabled", "true");
  });
});

describe("DataRequestsList: states", () => {
  it("says nothing is open, and offers the Closed view", () => {
    renderList({ list: { items: [], nextCursor: null }, pagination: null });
    expect(screen.getByText("No open data requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View closed" })).toBeInTheDocument();
  });

  it("has its own empty message for each view", () => {
    renderList({
      list: { items: [], nextCursor: null },
      filters: parseDataRequestsSearch({ view: "overdue" }),
      pagination: null,
    });
    expect(screen.getByText("No overdue requests")).toBeInTheDocument();
  });

  it("says nothing matches when a search finds no rows, with a way out", () => {
    renderList({
      list: { items: [], nextCursor: null },
      filters: parseDataRequestsSearch({ q: "jane@example.com" }),
      filtered: true,
      pagination: null,
    });
    expect(screen.getByText("No requests match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("keeps the frame and offers a retry when Identity does not answer", () => {
    renderList({
      list: null,
      summary: null,
      pagination: null,
      loadError:
        "Identity didn't answer. Overdue alerts still go out from Identity while this page is down.",
    });
    expect(screen.getByText("Data requests couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByText(/Overdue alerts still go out/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again|Retry/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Data requests" })).toBeInTheDocument();
  });
});
