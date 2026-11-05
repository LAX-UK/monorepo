import { listPage } from "@/lib/admin/purchase-problems/purchase-problem.fixture";
import { ASSIGNEES } from "@/lib/admin/purchase-problems/purchase-problem.fixture";
import {
  parsePurchaseProblemsSearch,
  purchaseProblemsPagination,
} from "@/lib/admin/purchase-problems/purchase-problems-search";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseProblemsList, type PurchaseProblemsListProps } from "./purchase-problems-list";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/purchase-problems",
  useSearchParams: () => new URLSearchParams(),
}));

function renderList(patch: Partial<PurchaseProblemsListProps> = {}) {
  const props: PurchaseProblemsListProps = {
    page: listPage,
    search: {},
    filters: parsePurchaseProblemsSearch({}),
    chips: [],
    assignees: ASSIGNEES,
    pagination: purchaseProblemsPagination({}, listPage),
    loadError: null,
    filtered: false,
    now: "2026-11-04T12:00:00.000Z",
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <PurchaseProblemsList {...props} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia =
    window.matchMedia ??
    ((query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList);
});

describe("PurchaseProblemsList", () => {
  it("shows the reference, buyer, lot, reason, raised time, owner and status of each report", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Purchase problems" })).toBeTruthy();
    const row = screen.getAllByRole("link", { name: "PR-8B1D4E2F" })[0]?.closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("Marcus Webb")).toBeTruthy();
    expect(cells.getByText("Harbour at dusk")).toBeTruthy();
    expect(cells.getByText("Not received")).toBeTruthy();
    expect(cells.getByText("Tom Reid")).toBeTruthy();
    expect(cells.getByText(/Tue 3 Nov, 14:05/)).toBeTruthy();
  });

  it("opens a report from its reference", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "PR-3F2A9C1E" })[0]?.getAttribute("href")).toBe(
      "/admin/purchase-problems/3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00",
    );
  });

  it("shows Unassigned for a report nobody owns", () => {
    renderList();
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
  });

  it("has a tab per status with its count, Open selected", () => {
    renderList();
    const open = screen.getByRole("link", { name: /^Open/ });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.textContent).toContain("3");
    expect(screen.getByRole("link", { name: /^In progress/ }).textContent).toContain("1");
    expect(screen.getByRole("link", { name: /^Resolved/ }).textContent).toContain("12");
  });

  it("searches by reference, buyer or lot", () => {
    renderList();
    const box = screen.getByRole("searchbox", { name: "Search purchase problems" });
    fireEvent.change(box, { target: { value: "ada" } });
    fireEvent.submit(box.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/admin/purchase-problems?q=ada", { scroll: false });
  });

  it("says what an empty tab means and offers the next one", () => {
    renderList({
      page: { ...listPage, items: [], total: 0, counts: { open: 0, in_progress: 1, resolved: 0 } },
      pagination: null,
    });
    expect(screen.getByText("No open purchase problems")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View in progress" }));
    expect(push).toHaveBeenCalledWith("/admin/purchase-problems?status=in_progress", {
      scroll: false,
    });
  });

  it("tells the person when the list could not be loaded, and retries", () => {
    renderList({ page: null, pagination: null, loadError: "The Bid API didn't answer." });
    expect(screen.getByText("Purchase problems couldn't be loaded")).toBeTruthy();
    expect(screen.getByText("The Bid API didn't answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again|retry/i })).toBeTruthy();
  });

  it("says nothing matched when a search finds nothing", () => {
    renderList({
      page: { ...listPage, items: [], total: 0 },
      pagination: null,
      filtered: true,
      filters: parsePurchaseProblemsSearch({ q: "zzz" }),
    });
    expect(screen.queryByText("No open purchase problems")).toBeNull();
    expect(screen.getByText(/No reports match/i)).toBeTruthy();
  });
});
