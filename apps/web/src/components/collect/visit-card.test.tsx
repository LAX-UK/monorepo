import type { VisitCardVm } from "@/lib/collect/collect-visit.vm";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const cancelAction = vi.fn();
vi.mock("@/lib/collect/collect.actions", () => ({
  cancelCollectionAction: (...a: unknown[]) => cancelAction(...a),
}));

import { VisitCard } from "./visit-card";

const BOOKING = "7a3e9c21-4b5d-4f6e-8a90-1c2d3e4f5a6b";

function bookedVisit(): VisitCardVm {
  return {
    id: BOOKING,
    reference: "COL-1042",
    live: true,
    status: "booked",
    tile: { weekday: "Thu", day: "12", month: "Nov" },
    when: "Thu 12 Nov, 14:00–14:30 GMT",
    where: "LAX, London",
    lots: [{ lotId: "lot-1", title: "Glass Horizon", lotNumber: 4, note: null }],
    collector: { name: "Ada Owner", detail: null, thirdParty: false },
    idRule: "Bring photo ID in the name of Ada Owner.",
    deadline: "Change or cancel online until Wed 11 Nov, 16:00 GMT.",
    afterCutoff: null,
    can: { change: true, cancel: true, calendar: true },
    changeHref: `/purchases/collect?booking=${BOOKING}`,
    calendarHref: `/purchases/collect/${BOOKING}/calendar.ics`,
    outcome: null,
    rebook: null,
    bookedByAnother: false,
    cancelled: false,
  } as VisitCardVm;
}

function confirmCancel() {
  const card = screen.getByRole("article");
  fireEvent.click(within(card).getByRole("button", { name: "Cancel booking" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
  );
}

describe("VisitCard cancel", () => {
  beforeEach(() => {
    refresh.mockReset();
    cancelAction.mockReset();
  });

  it("shows the visit cancelled as soon as the server answers, and reads the list again", async () => {
    cancelAction.mockResolvedValue({ ok: true, value: { id: BOOKING, status: "cancelled" } });
    render(<VisitCard visit={bookedVisit()} version={3} readOnly={false} />);

    confirmCancel();

    await waitFor(() => expect(screen.getByRole("article")).toHaveTextContent("Cancelled"));
    expect(cancelAction).toHaveBeenCalledWith({ bookingId: BOOKING, version: 3 });
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /change/i })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the refusal and reads the list again when the server refuses", async () => {
    cancelAction.mockResolvedValue({
      ok: false,
      failure: { kind: "too_late", message: "It is too late to change this visit online." },
    });
    render(<VisitCard visit={bookedVisit()} version={3} readOnly={false} />);

    confirmCancel();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "It is too late to change this visit online.",
      ),
    );
    expect(screen.getByRole("article")).toHaveTextContent("Booked");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not swallow a request that fails outright: it says so and reads the list again", async () => {
    cancelAction.mockRejectedValue(new Error("Failed to fetch"));
    render(<VisitCard visit={bookedVisit()} version={3} readOnly={false} />);

    confirmCancel();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
