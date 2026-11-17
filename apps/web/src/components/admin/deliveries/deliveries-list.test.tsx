import {
  BOOKED_UNPAID,
  COLLECTED,
  DELIVERY_FIXTURE_NOW,
  ON_THE_WAY,
  REFUNDED,
  WAITING_DELIVERIES,
  deliveriesPageFixture,
} from "@/lib/admin/deliveries/deliveries.fixture";
import { parseDeliveriesSearch } from "@/lib/admin/deliveries/deliveries.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveriesList, type DeliveriesListProps } from "./deliveries-list";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/deliveries",
  useSearchParams: () => new URLSearchParams(),
}));

const LOT_42 = "10700000-0000-4000-8000-000000000042";

function renderList(patch: Partial<DeliveriesListProps> = {}) {
  const search = patch.search ?? {};
  const props: DeliveriesListProps = {
    page: deliveriesPageFixture(),
    search,
    filters: parseDeliveriesSearch(search),
    chips: [],
    selected: null,
    pagination: null,
    loadError: null,
    filtered: false,
    canWork: true,
    now: DELIVERY_FIXTURE_NOW,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <DeliveriesList {...props} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  window.history.replaceState(null, "", "/admin/deliveries");
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("DeliveriesList", () => {
  it("lists each lot with its sale, buyer and paddle, where to, status and how long it waited", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Deliveries" })).toBeInTheDocument();
    const table = screen.getByRole("grid", { name: "Deliveries" });
    const row = within(table).getAllByRole("row")[1] as HTMLElement;
    expect(within(row).getByRole("link", { name: "Lot 42 · Harbour at dusk" })).toHaveAttribute(
      "href",
      `/admin/deliveries?record=${LOT_42}`,
    );
    expect(within(row).getByText("Modern British · Thu 12 Nov")).toBeInTheDocument();
    expect(within(row).getByText("Example Trading Ltd")).toBeInTheDocument();
    expect(within(row).getByText("Paddle 118")).toBeInTheDocument();
    expect(within(row).getByText("12 Rue Exemple, 69002 Lyon, France")).toBeInTheDocument();
    expect(within(row).getByText("Waiting for a price")).toBeInTheDocument();
    expect(within(row).getByText("None")).toBeInTheDocument();
    expect(within(row).getByText("Asked 2 days ago")).toBeInTheDocument();
  });

  it("offers the six views, each with its count, on the view in the URL", () => {
    renderList({
      search: { view: "on_the_way" },
      page: deliveriesPageFixture({ items: [ON_THE_WAY] }),
    });
    const nav = screen.getByRole("navigation", { name: "Views" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      // The Waiting tab's count is said as the sidebar says it: ", 3 waiting" (NAV-3).
      "Waiting for a price3 waiting",
      "Quoted1",
      "To dispatch1",
      "On the way1",
      "Delivered4",
      "Closed2",
    ]);
    expect(within(nav).getByRole("link", { name: /On the way/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByText("Example Couriers · EX123456789GB").length).toBeGreaterThan(0);
  });

  it("announces the Waiting for a price count as waiting, and only that tab's", () => {
    renderList();
    const nav = screen.getByRole("navigation", { name: "Views" });
    const waiting = within(nav).getByRole("link", { name: /Waiting for a price/ });
    expect(within(waiting).getByText("waiting")).toHaveClass("sr-only");
    expect(within(nav).getByRole("link", { name: /^Quoted/ }).textContent).toBe("Quoted1");
  });

  it("names the step alone when no time is recorded, never a made-up time", () => {
    renderList({
      search: { view: "closed" },
      page: deliveriesPageFixture({ items: [REFUNDED, COLLECTED] }),
    });
    const rows = within(screen.getByRole("grid")).getAllByRole("row");
    const refunded = rows[1] as HTMLElement;
    expect(within(refunded).getByText("Cancelled", { selector: "span[title]" })).toHaveAttribute(
      "title",
      "Time not recorded",
    );
    expect(refunded.querySelector("time")).toBeNull();
    const collected = rows[2] as HTMLElement;
    expect(within(collected).getByText("Collected in person")).toBeInTheDocument();
    expect(within(collected).getByText("Collected 1 hour ago")).toBeInTheDocument();
  });

  it("shows the price once quoted, and Awaiting payment beside an unpaid booking", () => {
    renderList({
      search: { view: "to_dispatch" },
      page: deliveriesPageFixture({ items: [BOOKED_UNPAID] }),
    });
    const row = within(screen.getByRole("grid")).getAllByRole("row")[1] as HTMLElement;
    expect(within(row).getByText("£180.00")).toBeInTheDocument();
    expect(within(row).getByText("Booked, not dispatched")).toBeInTheDocument();
    expect(within(row).getByText("Awaiting payment")).toBeInTheDocument();
  });

  it("says nobody is waiting, with no action, on an empty Waiting for a price", () => {
    renderList({ page: deliveriesPageFixture({ items: [], total: 0 }) });
    expect(screen.getByText("No buyers are waiting for a delivery price")).toBeInTheDocument();
    expect(
      screen.getByText("When a buyer asks for delivery on a won lot, it appears here."),
    ).toBeInTheDocument();
  });

  it("says each other view is empty in its own words", () => {
    renderList({
      search: { view: "delivered" },
      page: deliveriesPageFixture({ items: [], total: 0 }),
    });
    expect(screen.getByText("Nothing delivered yet")).toBeInTheDocument();
  });

  it("says no deliveries match a search, and clears it", () => {
    renderList({
      search: { q: "Paris" },
      filtered: true,
      page: deliveriesPageFixture({ items: [], total: 0 }),
    });
    expect(screen.getByText("No deliveries match")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0] as HTMLElement);
    expect(push).toHaveBeenCalledWith("/admin/deliveries", expect.anything());
  });

  it("says the list could not be loaded, as an alert, with Try again", () => {
    renderList({ page: null, loadError: "The Bid API didn't answer." });
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByText("Deliveries could not be loaded. Try again."),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("searches lot, paddle, buyer or destination", () => {
    renderList();
    const search = screen.getByRole("searchbox", { name: "Search deliveries" });
    expect(search).toHaveAttribute("placeholder", "Search lot, paddle, buyer or destination");
    fireEvent.change(search, { target: { value: "Cork" } });
    fireEvent.submit(search.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/admin/deliveries?q=Cork", expect.anything());
  });

  it("marks the page View only for read-only staff, and leaves Lot fulfilment out of the row menu", () => {
    renderList({ canWork: false });
    expect(screen.getAllByText("View only").length).toBeGreaterThan(0);
    const trigger = screen.getAllByRole("button", {
      name: "Actions for Lot 42 · Harbour at dusk",
    })[0];
    fireEvent.keyDown(trigger as HTMLElement, { key: "Enter" });
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByRole("menuitem", { name: "Open details" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Open lot fulfilment" })).toBeNull();
  });

  it("links Fulfilment to the lot's fulfilment record from the row menu", () => {
    renderList({ canWork: true });
    expect(screen.queryByText("View only")).toBeNull();
    const trigger = screen.getAllByRole("button", {
      name: "Actions for Lot 42 · Harbour at dusk",
    })[0];
    fireEvent.keyDown(trigger as HTMLElement, { key: "Enter" });
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: "Open lot fulfilment" }),
    ).toHaveAttribute("href", `/admin/lot-fulfilment?lot=${LOT_42}`);
  });
});

describe("DeliveriesList queue panel", () => {
  it("opens a row into the URL, shows its place and steps with J and K", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Lot 7 · Still life, blue jug")[0] as HTMLElement);
    expect(window.location.search).toBe(`?record=${WAITING_DELIVERIES[1]?.lotId}`);
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(queuePanel.title("Lot 113 · Untitled (grey)")).toBeVisible();
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(queuePanel.title("Lot 42 · Harbour at dusk")).toBeVisible();
  });

  it("reopens the lot from its address, even when it is not on this page", () => {
    window.history.replaceState(null, "", `/admin/deliveries?record=${ON_THE_WAY.lotId}`);
    renderList({
      search: { record: ON_THE_WAY.lotId },
      page: deliveriesPageFixture({ items: [], total: 0 }),
      selected: ON_THE_WAY,
    });
    expect(queuePanel.title("Lot 42 · Harbour at dusk")).toBeVisible();
    expect(within(queuePanel.get() as HTMLElement).getByText("On the way")).toBeVisible();
  });

  it("says a lot in the address has no delivery, with a way back to the list", () => {
    const gone = "10700000-0000-4000-8000-000000000999";
    window.history.replaceState(null, "", `/admin/deliveries?record=${gone}`);
    renderList({ search: { record: gone }, selected: null });
    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByText("This delivery could not be found")).toBeVisible();
    fireEvent.click(panel.getByRole("button", { name: "Back to the list" }));
    expect(window.location.search).toBe("");
  });

  it("keeps the list clear of the panel beside it while it is open", () => {
    const { container } = renderList();
    const inset = () => container.querySelector("[data-staff-panel-inset]");
    expect(inset()).toHaveAttribute("data-staff-panel-inset", "closed");
    fireEvent.click(screen.getAllByText("Lot 42 · Harbour at dusk")[0] as HTMLElement);
    expect(inset()).toHaveAttribute("data-staff-panel-inset", "open");
    expect(inset()).toHaveClass("xl:pr-[480px]");
  });

  it("closes on Back", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("Lot 42 · Harbour at dusk")[0] as HTMLElement);
    expect(queuePanel.get()).toBeInTheDocument();
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
  });
});
