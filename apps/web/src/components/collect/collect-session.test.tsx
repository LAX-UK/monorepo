import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/shell/shell-chrome-context", () => ({ HideBottomTabBarWhileMounted: () => null }));

const book = vi.fn();
const change = vi.fn();
const refreshTimes = vi.fn();
const readVisit = vi.fn();
vi.mock("@/lib/collect/collect.actions", () => ({
  bookCollectionAction: (...a: unknown[]) => book(...a),
  changeCollectionAction: (...a: unknown[]) => change(...a),
  refreshAvailabilityAction: (...a: unknown[]) => refreshTimes(...a),
  cancelCollectionAction: vi.fn(),
  readCollectionVisitAction: (...a: unknown[]) => readVisit(...a),
}));

import { CollectSession } from "./collect-session";

const START = "2026-11-12T14:00:00.000Z";
const LOT_A = "5d1b4c5e-7f0e-4c8e-9a54-2b7f3c1a9e01";
const LOT_B = "0c9e2a33-1d54-4f6b-8a7c-3e5d9b2f1a02";

function availability(over: Partial<CollectionAvailability> = {}): CollectionAvailability {
  return {
    venueId: "v",
    onlineBookingEnabled: true,
    bookingEmail: "info@thelax.art",
    visitMinutes: 30,
    windowDays: 28,
    noticeCutoffLocal: "16:00",
    timeZone: "Europe/London",
    earliest: START,
    days: [
      {
        date: "2026-11-12",
        state: "open",
        openSlots: 1,
        slots: [{ start: START, end: "2026-11-12T14:30:00.000Z", placesLeft: 1, state: "open" }],
      },
    ],
    lots: [
      {
        lotId: LOT_A,
        title: "Coastal Notation",
        lotNumber: 4,
        collectable: true,
        blockedReason: null,
        blockedMessage: null,
      },
      {
        lotId: LOT_B,
        title: "Blue Study",
        lotNumber: 5,
        collectable: false,
        blockedReason: "refund_open",
        blockedMessage: "A refund is being processed.",
      },
    ],
    ...over,
  };
}

const visit: CollectionVisitView = {
  id: "7a1b4c5e-7f0e-4c8e-9a54-2b7f3c1a9e09",
  reference: "COL-1042",
  status: "booked",
  start: START,
  end: "2026-11-12T14:30:00.000Z",
  version: 3,
  lots: [{ lotId: LOT_A, title: "Coastal Notation", lotNumber: 4, active: true, outcome: null }],
  collector: { kind: "self", name: "Ada Lovelace", email: null, company: null },
  authorisedAt: null,
  bookedByYou: true,
  bookedVia: "client",
  noticeDeadline: "2026-11-11T16:00:00.000Z",
  actions: ["change", "cancel"],
  handedOverAt: null,
  cancelledAt: null,
};

const confirmButton = (name: string) => screen.getAllByRole("button", { name })[0] as HTMLElement;

const draw = (over: Partial<Parameters<typeof CollectSession>[0]> = {}) =>
  render(
    <CollectSession
      availability={availability()}
      visit={null}
      myName="Ada Lovelace"
      organisation={null}
      viewOnly={false}
      nowIso="2026-11-09T10:00:00.000Z"
      contactEmail="info@thelax.art"
      {...over}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the collection booking page", () => {
  it("ticks the lots that can be booked and says why the others cannot", () => {
    draw();
    expect(screen.getByRole("checkbox", { name: /Coastal Notation/ })).toBeChecked();
    const blocked = screen.getByRole("checkbox", { name: /Blue Study/ });
    expect(blocked).toBeDisabled();
    expect(screen.getByText("A refund is being processed.")).toBeInTheDocument();
  });

  it("tells you what is missing, in a summary and under the field, before sending anything", async () => {
    draw();
    fireEvent.click(confirmButton("Confirm booking"));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Check 1 thing before booking");
    expect(screen.getAllByText("Choose a time.").length).toBeGreaterThan(1);
    expect(book).not.toHaveBeenCalled();
  });

  it("books the chosen time for me and shows the confirmation", async () => {
    book.mockResolvedValue({ ok: true, value: visit });
    draw();
    fireEvent.click(screen.getByRole("radio", { name: /14:00|15:00/ }));
    fireEvent.click(confirmButton("Confirm booking"));
    await waitFor(() => expect(book).toHaveBeenCalledTimes(1));
    const call = book.mock.calls[0]?.[0] as {
      body: { lotIds: string[]; collector: { kind: string } };
    };
    expect(call.body.lotIds).toEqual([LOT_A]);
    expect(call.body.collector.kind).toBe("self");
    expect(await screen.findByText(/Collection booked for/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add to calendar" })).toHaveAttribute(
      "href",
      `/purchases/collect/${visit.id}/calendar.ics`,
    );
  });

  it("keeps the details and asks for another time when the time was just taken", async () => {
    book.mockResolvedValue({
      ok: false,
      failure: {
        kind: "slot_taken",
        title: "That time has just been taken",
        message: "m",
        refresh: true,
      },
    });
    refreshTimes.mockResolvedValue({
      ok: true,
      value: availability({
        days: [
          {
            date: "2026-11-12",
            state: "full",
            openSlots: 0,
            slots: [{ start: START, end: START, placesLeft: 0, state: "full" }],
          },
        ],
      }),
    });
    draw();
    fireEvent.click(screen.getByRole("radio", { name: /14:00|15:00/ }));
    fireEvent.click(confirmButton("Confirm booking"));
    expect(await screen.findByText("That time has just been taken")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Coastal Notation/ })).toBeChecked();
  });

  it("needs the authorisation tick before someone else collects", async () => {
    draw();
    fireEvent.click(screen.getByRole("radio", { name: /14:00|15:00/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Someone else" }));
    fireEvent.change(screen.getByLabelText(/Their full name/), {
      target: { value: "Sam Shipper" },
    });
    fireEvent.click(confirmButton("Confirm booking"));
    expect(
      await screen.findByText("Tick the box to authorise them to collect.", { selector: "p" }),
    ).toBeInTheDocument();
    expect(book).not.toHaveBeenCalled();
  });

  it("shows the email route while online booking is off", () => {
    draw({ availability: availability({ onlineBookingEnabled: false }) });
    expect(screen.getByText("Online booking isn't open yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email us to book" })).toHaveAttribute(
      "href",
      "mailto:info@thelax.art",
    );
    expect(screen.queryByRole("button", { name: "Confirm booking" })).not.toBeInTheDocument();
  });

  it("lets someone viewing the account see it but not book", () => {
    draw({ viewOnly: true });
    expect(screen.getByText("You're viewing this account")).toBeInTheDocument();
    expect(confirmButton("Confirm booking")).toHaveAttribute("aria-disabled", "true");
  });

  it("changes a visit with its version and keeps its time until a new one is taken", async () => {
    change.mockResolvedValue({ ok: true, value: { ...visit, version: 4 } });
    draw({ visit });
    fireEvent.click(confirmButton("Move booking"));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
    expect(change.mock.calls[0]?.[0]).toMatchObject({ bookingId: visit.id, version: 3 });
    expect(await screen.findByText(/Collection moved to/)).toBeInTheDocument();
  });

  it("shows Booked when a change refused as out of date did take effect", async () => {
    change.mockResolvedValue({
      ok: false,
      failure: { kind: "changed", message: "This booking changed." },
    });
    readVisit.mockResolvedValue({ ok: true, value: { ...visit, version: 4 } });
    draw({ visit });
    // The visit's own time is kept, so asking for it again is what the re-read matches.
    fireEvent.click(screen.getAllByRole("radio", { name: /14:00|15:00/ })[0] as HTMLElement);
    fireEvent.click(confirmButton("Move booking"));
    expect(await screen.findByText(/Collection moved to/)).toBeInTheDocument();
  });
});
