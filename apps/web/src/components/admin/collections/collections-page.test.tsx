import { SETTINGS } from "@/lib/admin/collections/collections.fixture";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin/admin-collections", () => ({
  saveCollectionSettingsAction: vi.fn(),
  addCollectionExceptionAction: vi.fn(),
  removeCollectionExceptionAction: vi.fn(),
}));
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
});
