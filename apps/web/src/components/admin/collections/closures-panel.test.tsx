import { SETTINGS } from "@/lib/admin/collections/collections.fixture";
import type { StaffCollectionException, StaffCollectionSettings } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/actions/admin/admin-collections", () => ({
  addCollectionExceptionAction: mocks.add,
  removeCollectionExceptionAction: mocks.remove,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: () => false }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: mocks.success, error: vi.fn() } }));

const { ClosuresPanel } = await import("./closures-panel");

const TODAY = "2026-11-09";

const exception = (over: Partial<StaffCollectionException>): StaffCollectionException => ({
  id: "e1",
  kind: "closure",
  startsOn: "2026-12-25",
  endsOn: "2026-12-25",
  opensLocal: null,
  closesLocal: null,
  source: "bank_holiday",
  reason: null,
  saleTitle: null,
  canRemove: true,
  ...over,
});

const withExceptions = (exceptions: StaffCollectionException[]): StaffCollectionSettings => ({
  ...SETTINGS,
  exceptions,
});

const done = (settings: StaffCollectionSettings, cancelled = 0) => ({
  ok: true,
  data: { settings, affected: [], cancelled },
});

const AFFECTED = [
  {
    bookingId: "b1",
    reference: "COL-1001",
    start: "2026-12-24T11:00:00.000Z",
    end: "2026-12-24T11:30:00.000Z",
    reason: "closed",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Only the clock is pinned, so dates read the same whenever the tests run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("ClosuresPanel", () => {
  it("says so when nothing is coming up", () => {
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    expect(screen.getByText("No closures or extra openings")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add closure" })).toBeTruthy();
  });

  it("lists bank holidays, sale days and staff entries, and hides days already gone", () => {
    render(
      <ClosuresPanel
        settings={withExceptions([
          exception({ id: "past", startsOn: "2026-11-01", endsOn: "2026-11-02" }),
          exception({}),
          exception({
            id: null,
            source: "sale",
            startsOn: "2026-11-26",
            endsOn: "2026-11-26",
            saleTitle: "Winter Works on Paper: Live",
            canRemove: false,
          }),
          exception({
            id: "e3",
            source: "staff",
            kind: "extra_opening",
            startsOn: "2026-12-19",
            endsOn: "2026-12-19",
            opensLocal: "10:00",
            closesLocal: "16:00",
            reason: "Christmas Saturday",
          }),
        ])}
        canChange
        today={TODAY}
      />,
    );
    expect(screen.getByText("3 days or runs of days coming up")).toBeTruthy();
    expect(screen.queryByText("Sun 1 Nov to Mon 2 Nov")).toBeNull();
    expect(screen.getByText("Bank holiday")).toBeTruthy();
    expect(screen.getByText("Sale day")).toBeTruthy();
    expect(screen.getByText(/Winter Works on Paper: Live/)).toBeTruthy();
    expect(screen.getByText(/Open 10:00 to 16:00/)).toBeTruthy();
    // A sale day cannot be removed; the other two can.
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(2);
  });

  it("shows the next sale when sale days close collections", () => {
    render(
      <ClosuresPanel
        settings={{
          ...withExceptions([]),
          nextSaleDay: { saleTitle: "Winter Works on Paper: Live", startsOn: "2026-11-26" },
        }}
        canChange
        today={TODAY}
      />,
    );
    expect(screen.getByText("Sale days close collections")).toBeTruthy();
  });

  it("is view-only for someone who may not change it", () => {
    render(
      <ClosuresPanel settings={withExceptions([exception({})])} canChange={false} today={TODAY} />,
    );
    expect(screen.getByText("Fri 25 Dec")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add closure" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  });

  it("opens a sale day anyway, with the sale's days filled in", async () => {
    mocks.add.mockResolvedValue(done(withExceptions([])));
    render(
      <ClosuresPanel
        settings={withExceptions([
          exception({
            id: null,
            source: "sale",
            startsOn: "2026-11-26",
            endsOn: "2026-11-27",
            saleTitle: "Winter Works on Paper: Live",
            canRemove: false,
          }),
        ])}
        canChange
        today={TODAY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open anyway" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add extra opening" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1));
    expect(mocks.add.mock.calls[0]?.[1]).toMatchObject({
      kind: "extra_opening",
      startsOn: "2026-11-26",
      endsOn: "2026-11-27",
      opensLocal: null,
    });
  });

  it("adds an extra opening from its own button", async () => {
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Add extra opening" }));
    expect(await screen.findByText("Add extra opening", { selector: "h2" })).toBeTruthy();
  });

  it("adds a closure for a day and says so", async () => {
    mocks.add.mockResolvedValue(done(withExceptions([exception({ source: "staff" })])));
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    fireEvent.change(await screen.findByLabelText(/Note/), { target: { value: "Staff party" } });
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1));
    expect(mocks.add.mock.calls[0]).toEqual([
      SETTINGS.venueId,
      {
        kind: "closure",
        startsOn: TODAY,
        endsOn: TODAY,
        opensLocal: null,
        closesLocal: null,
        reason: "Staff party",
      },
    ]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Closure added."));
  });

  it("asks for both times when only part of a day is closed", async () => {
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    fireEvent.click(await screen.findByRole("switch", { name: /Only part of each day/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    expect((await screen.findAllByText("Enter a time such as 13:00.")).length).toBeGreaterThan(0);
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("lists the visits a closure would hit, then sends the choice made", async () => {
    mocks.add
      .mockResolvedValueOnce({
        ok: false,
        error: "x",
        errorCode: "bookings_affected",
        meta: { affected: AFFECTED },
      })
      .mockResolvedValueOnce(done(withExceptions([exception({ source: "staff" })]), 1));
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add closure" }));
    expect(await screen.findByText("1 booking falls inside this closure")).toBeTruthy();
    expect(screen.getByText("Closed that day")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Cancel and ask to rebook/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close and email 1 client" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
    expect((mocks.add.mock.calls[1]?.[1] as Record<string, unknown>).affectedBookings).toBe(
      "cancel_and_rebook",
    );
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Added. 1 visit cancelled."));
  });

  it("says why a closure could not be added", async () => {
    mocks.add.mockResolvedValue({
      ok: false,
      error: "We couldn't reach the settings.",
      status: 503,
    });
    render(<ClosuresPanel settings={withExceptions([])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add closure" }));
    expect(await screen.findByText("It couldn't be added")).toBeTruthy();
    expect(screen.getByText("We couldn't reach the settings.")).toBeTruthy();
  });

  it("confirms before removing, and then removes it", async () => {
    mocks.remove.mockResolvedValue(done(withExceptions([])));
    render(<ClosuresPanel settings={withExceptions([exception({})])} canChange today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Fri 25 Dec" }));
    expect(await screen.findByText("Remove the closure on Fri 25 Dec?")).toBeTruthy();
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(mocks.remove.mock.calls[0]).toEqual([SETTINGS.venueId, "e1", {}]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Removed."));
  });

  it("lists the visits an extra opening's removal would strand, before removing it", async () => {
    mocks.remove.mockResolvedValue({
      ok: false,
      error: "x",
      errorCode: "bookings_affected",
      meta: { affected: AFFECTED },
    });
    render(
      <ClosuresPanel
        settings={withExceptions([exception({ kind: "extra_opening", source: "staff" })])}
        canChange
        today={TODAY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Fri 25 Dec" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(await screen.findByText("1 booking falls outside the regular hours")).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
