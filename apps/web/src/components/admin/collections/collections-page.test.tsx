import { SETTINGS } from "@/lib/admin/collections/collections.fixture";
import { deskBooking, deskDay } from "@/lib/admin/collections/desk.fixture";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin/admin-collections", () => ({
  saveCollectionSettingsAction: vi.fn(),
  addCollectionExceptionAction: vi.fn(),
  removeCollectionExceptionAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-collection-desk", () => ({
  handOverCollectionAction: vi.fn(),
  undoHandOverCollectionAction: vi.fn(),
  markNotCollectedAction: vi.fn(),
  rebookCollectionAction: vi.fn(),
  bookForClientAction: vi.fn(),
  loadDeskDayAction: vi.fn(),
  loadDeskClientLotsAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-lot-fulfilment", () => ({
  adminLotFulfilmentReleaseResultAction: vi.fn(),
}));
vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({ searchLegalEntityOptions: vi.fn() }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { CollectionsPage } = await import("./collections-page");

const VENUE = {
  venueId: SETTINGS.venueId,
  name: "London Art Exchange, 156 New Cavendish Street",
  hasPlace: true,
  onlineBookingEnabled: false,
};

const base = {
  tab: "hours" as const,
  venues: [VENUE],
  settings: SETTINGS,
  loadError: null,
  canChange: true,
  today: "2026-11-09",
};

describe("CollectionsPage", () => {
  it("opens on Hours and rules, with the Closures tab beside it", () => {
    render(<CollectionsPage {...base} />);
    expect(screen.getByRole("heading", { level: 1, name: "Collections" })).toBeTruthy();
    const current = screen.getByRole("link", { name: "Hours and rules" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Closures" }).getAttribute("href")).toBe(
      `/admin/collections?tab=closures&venue=${SETTINGS.venueId}`,
    );
    expect(screen.getByRole("form", { name: "Hours and rules" })).toBeTruthy();
  });

  it("shows the closures on the Closures tab", () => {
    render(<CollectionsPage {...base} tab="closures" />);
    expect(screen.getByRole("link", { name: "Closures" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByText("No closures or extra openings")).toBeTruthy();
  });

  it("tells staff that online booking is off", () => {
    render(<CollectionsPage {...base} />);
    expect(screen.getByText("Online booking is off")).toBeTruthy();
    render(<CollectionsPage {...base} settings={{ ...SETTINGS, onlineBookingEnabled: true }} />);
    expect(screen.getAllByText("Online booking is off")).toHaveLength(1);
  });

  it("marks the page view-only for someone who may not change it", () => {
    render(<CollectionsPage {...base} canChange={false} />);
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.getByText(/is for the Fulfilment team/)).toBeTruthy();
  });

  it("offers each place when there are several", () => {
    render(
      <CollectionsPage
        {...base}
        venues={[VENUE, { ...VENUE, venueId: "other", name: "Second place" }]}
      />,
    );
    const places = screen.getByRole("navigation", { name: "Places" });
    expect(places.textContent).toContain("Second place");
    expect(screen.getByRole("link", { name: VENUE.name }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("says the page didn't load, with a way to try again", () => {
    render(
      <CollectionsPage
        {...base}
        settings={null}
        venues={[]}
        loadError="We couldn't load the collection settings. Try again in a moment."
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Collections didn't load");
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/admin/collections",
    );
  });

  it("says there is no place when there are no venues", () => {
    render(<CollectionsPage {...base} settings={null} venues={[]} />);
    expect(screen.getByText("No place to collect from")).toBeTruthy();
  });

  it("opens on the Day tab with the five tabs, and the count of visits to follow up", () => {
    render(
      <CollectionsPage
        {...base}
        tab="day"
        desk={{ date: "2026-11-12", day: deskDay(), list: null, missedCount: 3, error: null }}
      />,
    );
    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent)
      .filter((text) => /Day|Upcoming|Not collected|Hours and rules|Closures/.test(text ?? ""));
    expect(names.map((n) => n?.replace(/\d+$/, ""))).toEqual([
      "Day",
      "Upcoming",
      "Not collected",
      "Hours and rules",
      "Closures",
    ]);
    expect(screen.getByRole("link", { name: /Not collected/ }).textContent).toContain("3");
    expect(screen.getByRole("link", { name: "Day" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Hayes Collection")).toBeTruthy();
  });

  it("shows the missed visits on the Not collected tab", () => {
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        desk={{
          date: "2026-11-12",
          day: null,
          list: {
            venueId: SETTINGS.venueId,
            status: "not_collected",
            items: [deskBooking({ status: "not_collected", actions: ["rebook"] })],
          },
          missedCount: 1,
          error: null,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Book again" })).toBeTruthy();
  });

  it("says the visits did not load, with a way to try again", () => {
    render(
      <CollectionsPage
        {...base}
        tab="day"
        desk={{ date: "2026-11-12", day: null, list: null, missedCount: null, error: "Try later" }}
      />,
    );
    expect(screen.getByText("The visits didn't load")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try again" })).toBeTruthy();
  });

  it("does not tell the Day tab that online booking is off", () => {
    render(
      <CollectionsPage
        {...base}
        tab="day"
        settings={{ ...SETTINGS, onlineBookingEnabled: false }}
        desk={{ date: "2026-11-12", day: deskDay(), list: null, missedCount: 0, error: null }}
      />,
    );
    expect(screen.queryByText("Online booking is off")).toBeNull();
  });
});
