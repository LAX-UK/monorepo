import { DESK_VENUE, deskBooking, deskDay } from "@/lib/admin/collections/desk.fixture";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/lib/actions/admin/admin-collection-desk", () => ({
  handOverCollectionAction: vi.fn(),
  undoHandOverCollectionAction: vi.fn(),
  markNotCollectedAction: vi.fn(),
  rebookCollectionAction: vi.fn(),
  bookForClientAction: vi.fn(),
  loadDeskDayAction: vi.fn().mockResolvedValue({ ok: false, error: "x" }),
  loadDeskClientLotsAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-lot-fulfilment", () => ({
  adminLotFulfilmentReleaseResultAction: vi.fn(),
}));
const addException = vi.fn();
vi.mock("@/lib/actions/admin/admin-collections", () => ({
  addCollectionExceptionAction: (...a: unknown[]) => addException(...a),
}));
vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({
  searchLegalEntityOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));

const { DeskDay } = await import("./desk-day");
const { DeskList } = await import("./desk-list");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the day at the desk", () => {
  it("groups visits by time with the places taken, and lists who is coming", () => {
    render(<DeskDay day={deskDay()} canChange today="2026-11-12" />);
    expect(screen.getByRole("heading", { name: "14:00–14:30" })).toBeTruthy();
    expect(screen.getByText("2 of 2 booked")).toBeTruthy();
    expect(screen.getByText("Hayes Collection")).toBeTruthy();
    expect(screen.getByText("Okafor Trust")).toBeTruthy();
    expect(screen.getByText(/Third party · Fast Freight Ltd/)).toBeTruthy();
    expect(screen.getByText("2 visits · 2 to hand over · 16 times still open")).toBeTruthy();
  });

  it("warns Release first on a visit with an unreleased lot, and Ready on the rest", () => {
    render(<DeskDay day={deskDay()} canChange today="2026-11-12" />);
    const first = screen.getByText("COL-1042").closest("li") as HTMLElement;
    const second = screen.getByText("COL-1043").closest("li") as HTMLElement;
    expect(within(first).getByText("Ready")).toBeTruthy();
    expect(within(second).getByText("Release first")).toBeTruthy();
  });

  it("offers the actions the server allows, and none to someone who may only look", () => {
    const { unmount } = render(<DeskDay day={deskDay()} canChange today="2026-11-12" />);
    expect(screen.getAllByRole("button", { name: "Hand over" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Not collected" }).length).toBe(2);
    expect(screen.getByRole("button", { name: "Book for a client" })).toBeTruthy();
    unmount();
    render(<DeskDay day={deskDay()} canChange={false} today="2026-11-12" />);
    expect(screen.queryByRole("button", { name: "Hand over" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Book for a client" })).toBeNull();
  });

  it("opens the hand-over panel for the visit", async () => {
    render(<DeskDay day={deskDay()} canChange today="2026-11-12" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Hand over" })[0] as HTMLElement);
    expect(
      await screen.findByRole("heading", { name: "Hand over to Charlotte Hayes" }),
    ).toBeTruthy();
  });

  it("confirms before marking a visit not collected, and says what the buyer is told", () => {
    render(<DeskDay day={deskDay()} canChange today="2026-11-12" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Not collected" })[0] as HTMLElement);
    expect(screen.getByRole("heading", { name: "Mark COL-1042 as not collected?" })).toBeTruthy();
    expect(screen.getByText(/There's no fee/)).toBeTruthy();
  });

  it("moves between days with links", () => {
    render(<DeskDay day={deskDay()} canChange today="2026-11-09" />);
    expect(screen.getByRole("link", { name: "Next day" }).getAttribute("href")).toBe(
      `/admin/collections?venue=${DESK_VENUE}&date=2026-11-13`,
    );
    expect(screen.getByRole("link", { name: "Previous day" }).getAttribute("href")).toBe(
      `/admin/collections?venue=${DESK_VENUE}&date=2026-11-11`,
    );
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("href")).toBe(
      `/admin/collections?venue=${DESK_VENUE}&date=2026-11-09`,
    );
  });

  it("says how many times are open on an empty day", () => {
    render(
      <DeskDay
        day={deskDay({ groups: [], toHandOver: 0, openTimes: 18 })}
        canChange
        today="2026-11-12"
      />,
    );
    expect(screen.getByText("No visits booked", { selector: "h2,h3,p,div" })).toBeTruthy();
    expect(screen.getByText("18 times are still open on this day.")).toBeTruthy();
  });

  it("says why a closed day is closed, and offers to open a sale day anyway", async () => {
    addException.mockResolvedValue({ ok: true });
    render(
      <DeskDay
        day={deskDay({ state: "sale_day", canOpenAnyway: true, groups: [], toHandOver: 0 })}
        canChange
        today="2026-11-12"
      />,
    );
    expect(screen.getByText("Closed for a sale day")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open this day anyway" }));
    await waitFor(() => expect(addException).toHaveBeenCalledTimes(1));
    expect(addException.mock.calls[0]).toEqual([
      DESK_VENUE,
      expect.objectContaining({
        kind: "extra_opening",
        startsOn: "2026-11-12",
        endsOn: "2026-11-12",
      }),
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("offers no way to open an ordinary closed day", () => {
    render(
      <DeskDay
        day={deskDay({ state: "closed", groups: [], toHandOver: 0 })}
        canChange
        today="2026-11-12"
      />,
    );
    expect(screen.getByText("Closed this day")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open this day anyway" })).toBeNull();
  });

  it("shows a handed-over visit with its ID type and an Undo while it can be undone", () => {
    render(
      <DeskDay
        day={deskDay({
          groups: [
            {
              start: "2026-11-12T14:00:00.000Z",
              end: "2026-11-12T14:30:00.000Z",
              taken: 1,
              capacity: 2,
              bookings: [
                deskBooking({
                  status: "collected",
                  idCheckType: "passport",
                  actions: ["undo"],
                }),
              ],
            },
          ],
        })}
        canChange
        today="2026-11-12"
      />,
    );
    expect(screen.getByText(/Passport checked/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo hand-over" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hand over" })).toBeNull();
  });
});

describe("the lists", () => {
  const list = (status: "upcoming" | "not_collected", items = [deskBooking()]) => ({
    venueId: DESK_VENUE,
    status,
    items,
  });

  it("lists upcoming visits a day at a time, with the time in each row", () => {
    render(<DeskList list={list("upcoming")} canChange today="2026-11-09" />);
    expect(screen.getByRole("heading", { name: "Thu 12 Nov" })).toBeTruthy();
    expect(screen.getByText(/COL-1042 · 14:00–14:30/)).toBeTruthy();
  });

  it("offers Book again on a missed visit", () => {
    render(
      <DeskList
        list={list("not_collected", [
          deskBooking({ status: "not_collected", actions: ["rebook"] }),
        ])}
        canChange
        today="2026-11-13"
      />,
    );
    expect(screen.getByText("1 visit to follow up")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Book again" })).toBeTruthy();
  });

  it("says when there is nothing to follow up", () => {
    render(<DeskList list={list("not_collected", [])} canChange today="2026-11-13" />);
    expect(screen.getByText("Nothing to follow up")).toBeTruthy();
  });

  it("says when no visits are to come", () => {
    render(<DeskList list={list("upcoming", [])} canChange today="2026-11-13" />);
    expect(screen.getByText("No visits to come")).toBeTruthy();
  });
});
