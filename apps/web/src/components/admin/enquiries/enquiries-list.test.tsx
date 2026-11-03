import { parseEnquiriesSearch } from "@/lib/admin/enquiries/enquiries-search";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnquiriesList, type EnquiriesListProps } from "./enquiries-list";
import { ASSIGNEES, listItem } from "./enquiry.fixture";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/enquiries",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-enquiries", () => ({
  updateEnquiryAction: vi.fn(),
  saveEnquiryRoutingAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const NOW = "2026-11-03T12:00:00.000Z";
const specialist = { canWork: true, canRoute: false, defaultView: "assigned_to_me" } as const;
const manager = { canWork: true, canRoute: true, defaultView: "open" } as const;

function renderList(patch: Partial<EnquiriesListProps> = {}) {
  const abilities = patch.abilities ?? specialist;
  const props: EnquiriesListProps = {
    page: {
      items: [
        listItem(),
        listItem({
          id: "id-1038",
          reference: "E-1038",
          name: "Amara Osei",
          maskedEmail: "a•••@example.com",
          hasAccount: true,
          assignedToUserId: null,
          receivedAt: "2026-10-29T10:00:00.000Z",
          replyDueAt: "2026-10-31T10:00:00.000Z",
        }),
        listItem({
          id: "id-1041",
          reference: "E-1041",
          name: "Marlow Collection Ltd",
          intent: "private_sale_buy",
          topicLabel: "Buy privately",
          departmentSlug: null,
          assignedToUserId: "u-tom",
          status: "in_progress",
          receivedAt: "2026-11-03T09:00:00.000Z",
          replyDueAt: "2026-11-05T09:00:00.000Z",
        }),
      ],
      nextCursor: null,
    },
    search: {},
    filters: parseEnquiriesSearch({}, abilities.defaultView),
    chips: [],
    assignees: ASSIGNEES,
    routing: null,
    abilities,
    pagination: { summary: "3 enquiries", prevHref: null, nextHref: null },
    loadError: null,
    filtered: false,
    now: NOW,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <EnquiriesList {...props} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("EnquiriesList: rows", () => {
  it("shows the client, a masked email with the reference, whether they have an account, and the kind", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Enquiries" })).toBeInTheDocument();
    expect(screen.getAllByText("E-1042 · d•••@example.com · Guest").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E-1038 · a•••@example.com · Account").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/daniel\.price@/);
    expect(screen.getAllByText("Paintings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Buy privately").length).toBeGreaterThan(0);
  });

  it("links each client to the record by reference", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: /Daniel Price/ })[0]).toHaveAttribute(
      "href",
      "/admin/enquiries/E-1042",
    );
  });

  it("names the assignee, or says nobody has it", () => {
    renderList();
    expect(screen.getAllByText("Sofia Okafor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
  });

  it("measures waiting against the two business days: warning in the last day, danger once over", () => {
    renderList();
    expect(screen.getAllByText(/Over 2 days/).length).toBeGreaterThan(0);
    // 27 hours into a 48 hour promise: a warning, in words.
    expect(screen.getAllByText(/Waiting 1 day; reply due within a day/).length).toBeGreaterThan(0);
    // Someone is working the third: time without a warning.
    expect(screen.getAllByText(/3 h/).length).toBeGreaterThan(0);
  });

  it("names the order under the table", () => {
    renderList();
    expect(screen.getByText(/3 enquiries · Longest waiting first/)).toBeInTheDocument();
  });
});

describe("EnquiriesList: views and filters", () => {
  it("offers the six views, the person's own one selected", () => {
    renderList();
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Assigned to me", "Open", "Unassigned", "Private sales", "Closed", "All"]);
    expect(within(nav).getByRole("link", { name: "Assigned to me" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the landing view out of the address and writes the others in", () => {
    renderList();
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(within(nav).getByRole("link", { name: "Assigned to me" })).toHaveAttribute(
      "href",
      "/admin/enquiries",
    );
    expect(within(nav).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/admin/enquiries?view=open",
    );
  });

  it("has no search box or sort control, because the API offers neither", () => {
    renderList();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Sort/ })).toBeNull();
  });

  it("shows a removable chip for each filter in force", () => {
    const search = { kind: "private_sale_sell" };
    renderList({
      search,
      filters: parseEnquiriesSearch(search, "assigned_to_me"),
      chips: [{ id: "kind", label: "Kind: Sell privately", clearHref: "/admin/enquiries" }],
      filtered: true,
    });
    expect(screen.getByText("Kind: Sell privately")).toBeInTheDocument();
  });
});

describe("EnquiriesList: states", () => {
  it("says what the view is for when it is empty, and offers all enquiries from the landing view", () => {
    renderList({ page: { items: [], nextCursor: null }, pagination: null });
    expect(screen.getByText("Nothing assigned to you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all enquiries" }));
    expect(push).toHaveBeenCalledWith("/admin/enquiries?view=all", { scroll: false });
  });

  it("says nothing matched when filters narrow the list to nothing", () => {
    renderList({ page: { items: [], nextCursor: null }, pagination: null, filtered: true });
    expect(screen.getByText("No enquiries match")).toBeInTheDocument();
  });

  it("explains a load failure and keeps the frame", () => {
    renderList({ page: null, pagination: null, loadError: "The Bid API didn't answer." });
    expect(screen.getByText("Enquiries couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("EnquiriesList: routing", () => {
  it("is offered only to people who may change it", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Routing" })).toBeNull();
    renderList({ abilities: manager, routing: [] });
    expect(screen.getByRole("button", { name: "Routing" })).toBeInTheDocument();
  });

  it("opens the routing dialog", async () => {
    renderList({
      abilities: manager,
      routing: [{ departmentSlug: null, assignedToUserId: "u-tom" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Routing" }));
    expect(await screen.findByRole("dialog", { name: "Enquiry routing" })).toBeInTheDocument();
  });
});
