import { SETTINGS } from "@/lib/admin/collections/collections.fixture";
import { COLLECTION_TABS } from "@/lib/admin/collections/collections.vm";
import { deskDay, deskList } from "@/lib/admin/collections/desk.fixture";
import { STORAGE } from "@/lib/admin/collections/storage.fixture";
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
vi.mock("@/lib/actions/admin/admin-collection-storage", () => ({
  scheduleStorageTermsAction: vi.fn(),
  editStorageTermsAction: vi.fn(),
  cancelStorageTermsAction: vi.fn(),
  setStorageChargingAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-collection-overdue", () => ({
  extendLotStorageAction: vi.fn(),
  waiveLotStorageAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-lot-fulfilment", () => ({
  adminLotFulfilmentReleaseResultAction: vi.fn(),
}));
vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({ searchLegalEntityOptions: vi.fn() }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { CollectionsPage } = await import("./collections-page");
const { CollectionsLoadingSkeleton } = await import("./collections-loading-skeleton");

const VENUE = {
  venueId: SETTINGS.venueId,
  name: "London Art Exchange, 156 New Cavendish Street",
  hasPlace: true,
  onlineBookingEnabled: false,
};

const base = {
  tab: "hours" as const,
  tabs: COLLECTION_TABS,
  venues: [VENUE],
  venueId: SETTINGS.venueId,
  settings: SETTINGS,
  loadError: null,
  canChange: true,
  canChangeStorage: false,
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
        venueId={null}
        loadError="We couldn't load the collection settings. Try again in a moment."
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Collections didn't load");
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/admin/collections",
    );
  });

  it("says there is no place when there are no venues", () => {
    render(<CollectionsPage {...base} settings={null} venues={[]} venueId={null} />);
    expect(screen.getByText("No place to collect from")).toBeTruthy();
  });

  it("opens on the Day tab with the six tabs, and the count of visits to follow up", () => {
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
      .filter((text) =>
        /Day|Upcoming|Not collected|Hours and rules|Storage|Closures/.test(text ?? ""),
      );
    expect(names.map((n) => n?.replace(/\d+$/, ""))).toEqual([
      "Day",
      "Upcoming",
      "Not collected",
      "Hours and rules",
      "Storage",
      "Closures",
    ]);
    expect(screen.getByRole("link", { name: /Not collected/ }).textContent).toContain("3");
    expect(screen.getByRole("link", { name: "Day" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Hayes Collection")).toBeTruthy();
  });

  it("puts Book for a client in the page header on every desk tab, and not on the settings tabs", () => {
    const desk = { date: "2026-11-12", day: deskDay(), list: null, missedCount: 0, error: null };
    const { unmount } = render(<CollectionsPage {...base} tab="day" desk={desk} />);
    expect(screen.getByRole("button", { name: "Book for a client" })).toBeTruthy();
    unmount();
    const { unmount: again } = render(
      <CollectionsPage
        {...base}
        tab="upcoming"
        desk={{ ...desk, day: null, list: deskList("upcoming") }}
      />,
    );
    expect(screen.getByRole("button", { name: "Book for a client" })).toBeTruthy();
    again();
    const { unmount: third } = render(<CollectionsPage {...base} tab="hours" />);
    expect(screen.queryByRole("button", { name: "Book for a client" })).toBeNull();
    third();
    render(<CollectionsPage {...base} tab="day" desk={desk} canChange={false} />);
    expect(screen.queryByRole("button", { name: "Book for a client" })).toBeNull();
  });

  it("shows the missed visits on the Not collected tab", () => {
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        desk={{
          date: "2026-11-12",
          day: null,
          list: deskList("not_collected", { venueId: SETTINGS.venueId }),
          missedCount: 1,
          error: null,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Rebook" })).toBeTruthy();
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

describe("CollectionsPage, Storage tab", () => {
  const storageTab = {
    ...base,
    tab: "storage" as const,
    storage: { settings: STORAGE, error: null },
    canChangeStorage: true,
  };

  it("sits beside Hours and rules and says in the header whether charging is on", () => {
    render(<CollectionsPage {...storageTab} />);
    expect(screen.getByRole("link", { name: "Storage" }).getAttribute("aria-current")).toBe("page");
    const heading = screen.getByRole("heading", { level: 1, name: "Collections" });
    expect(heading.parentElement?.textContent).toContain("Charging off");
    expect(screen.getByRole("region", { name: "In force" })).toBeTruthy();
    expect(screen.queryByText("Online booking is off")).toBeNull();
    expect(screen.queryByRole("form", { name: "Hours and rules" })).toBeNull();
  });

  it("shows Charging on when invoices are raised", () => {
    render(
      <CollectionsPage
        {...storageTab}
        storage={{
          settings: { ...STORAGE, charging: { raiseInvoices: true, vatTreatment: "zero_rated" } },
          error: null,
        }}
      />,
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Collections" });
    expect(heading.parentElement?.textContent).toContain("Charging on");
  });

  it("tells Fulfilment that only Finance and Admins can change the terms", () => {
    render(<CollectionsPage {...storageTab} canChangeStorage={false} />);
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.getByText("Only Finance and Admins can change storage terms.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Schedule a change" })).toBeNull();
  });

  it("says the terms didn't load, with a way to try again", () => {
    render(
      <CollectionsPage
        {...storageTab}
        storage={{
          settings: null,
          error: "We couldn't load the storage terms. Try again in a moment.",
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Storage terms didn't load");
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      `/admin/collections?tab=storage&venue=${SETTINGS.venueId}`,
    );
  });

  it("shows Finance the Storage tab only", () => {
    render(<CollectionsPage {...storageTab} tabs={["storage"]} settings={null} />);
    const tabs = screen.getByRole("navigation", { name: "Collections sections" });
    expect(tabs.textContent).toBe("Storage");
    expect(screen.getByRole("region", { name: "In force" })).toBeTruthy();
  });

  it("holds the Storage tab's shape while it loads", () => {
    const { container } = render(<CollectionsLoadingSkeleton tab="storage" />);
    expect(screen.getByRole("link", { name: "Storage" }).getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText("Buyer")).toBeNull();
  });
});

describe("CollectionsPage › Not collected", () => {
  it("shows the lots past collect-by above the missed visits", async () => {
    const { OVERDUE } = await import("@/lib/admin/collections/not-collected.fixture");
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        desk={{
          date: "2026-11-09",
          day: null,
          list: deskList("not_collected"),
          missedCount: 1,
          error: null,
        }}
        overdue={{ lots: OVERDUE, error: null }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Past collect-by" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Missed visits" })).toBeTruthy();
    expect(screen.getByText("14 days over")).toBeTruthy();
  });

  it("shows Finance only the lots, with Waive and no visits", async () => {
    const { OVERDUE } = await import("@/lib/admin/collections/not-collected.fixture");
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        tabs={["not_collected", "storage"]}
        settings={null}
        canChange={false}
        canChangeStorage
        overdue={{ lots: OVERDUE, error: null }}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Missed visits" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Waive charges" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Extend free storage" })).toBeNull();
    expect(screen.queryByText("View only")).toBeNull();
  });

  it("marks the tab view-only for someone who can neither extend nor waive", async () => {
    const { OVERDUE } = await import("@/lib/admin/collections/not-collected.fixture");
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        canChange={false}
        overdue={{ lots: OVERDUE, error: null }}
      />,
    );
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.getByText(/Extending free storage is for Fulfilment/)).toBeTruthy();
  });

  it("says the lots didn't load, with a way to try again", () => {
    render(
      <CollectionsPage
        {...base}
        tab="not_collected"
        settings={null}
        overdue={{ lots: null, error: "We couldn't load them. Try again in a moment." }}
      />,
    );
    expect(screen.getByText("The lots past collect-by didn't load")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      `/admin/collections?tab=not_collected&venue=${SETTINGS.venueId}`,
    );
  });

  it("holds the lots' shape while the tab loads", () => {
    render(<CollectionsLoadingSkeleton tab="not_collected" tabs={["not_collected", "storage"]} />);
    expect(screen.getByRole("heading", { name: "Past collect-by" })).toBeTruthy();
  });
});
