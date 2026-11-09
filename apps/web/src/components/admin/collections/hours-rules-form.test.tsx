import { SETTINGS } from "@/lib/admin/collections/collections.fixture";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  refresh: vi.fn(),
  stepUp: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/actions/admin/admin-collections", () => ({
  saveCollectionSettingsAction: mocks.save,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  handleStaffStepUp: (failure: { errorCode?: string }) => {
    mocks.stepUp(failure);
    return failure.errorCode === "step_up_required";
  },
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: mocks.success, error: vi.fn() } }));

const { HoursRulesForm } = await import("./hours-rules-form");

const saved = (over: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    settings: { ...SETTINGS, version: "2026-11-09T12:00:00.000Z", ...over },
    affected: [],
    cancelled: 0,
  },
});

const BOOKINGS = [
  {
    bookingId: "b1",
    reference: "COL-1001",
    start: "2026-11-13T17:30:00.000Z",
    end: "2026-11-13T18:00:00.000Z",
    reason: "outside_hours",
  },
  {
    bookingId: "b2",
    reference: "COL-1002",
    start: "2026-11-13T18:00:00.000Z",
    end: "2026-11-13T18:30:00.000Z",
    reason: "outside_hours",
  },
];

function renderForm(canChange = true) {
  return render(<HoursRulesForm settings={SETTINGS} canChange={canChange} />);
}

const closesOnMonday = () => screen.getByLabelText("Monday closes") as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("HoursRulesForm", () => {
  it("shows the saved hours and rules, and nothing to save yet", () => {
    renderForm();
    expect(closesOnMonday().value).toBe("19:00");
    expect(screen.getAllByText("Closed")).toHaveLength(2);
    expect(screen.getByText("All changes saved")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("is read-only for someone who may not change it", () => {
    renderForm(false);
    expect(closesOnMonday().disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add hours/ })).toBeNull();
  });

  it("sends the changed hours with the version it loaded, then shows what was saved", async () => {
    mocks.save.mockResolvedValue(saved());
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const [venueId, body] = mocks.save.mock.calls[0] as [string, Record<string, unknown>];
    expect(venueId).toBe(SETTINGS.venueId);
    expect(body.version).toBe(SETTINGS.version);
    expect(body.affectedBookings).toBeUndefined();
    expect((body.hours as { closesLocal: string }[])[0]?.closesLocal).toBe("17:00");
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Collection settings saved."));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("marks the row at fault and sends nothing", async () => {
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "09:00" } });
    fireEvent.click(saveButton());
    expect((await screen.findAllByText("Closing must be after opening.")).length).toBeGreaterThan(
      0,
    );
    expect(closesOnMonday().getAttribute("aria-invalid")).toBe("true");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("lists the bookings a save would affect before anything is decided, and keeps the edit", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: "Some bookings fall outside this change.",
      errorCode: "bookings_affected",
      meta: { affected: BOOKINGS },
    });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("2 bookings fall outside the new hours")).toBeTruthy();
    expect(screen.getByText("COL-1001")).toBeTruthy();
    expect(screen.getByText(/Fri 13 Nov, 17:30–18:00 GMT/)).toBeTruthy();
    expect(screen.getAllByText("Outside the opening hours")).toHaveLength(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("sends the choice to cancel when staff make it", async () => {
    mocks.save
      .mockResolvedValueOnce({
        ok: false,
        error: "x",
        errorCode: "bookings_affected",
        meta: { affected: BOOKINGS },
      })
      .mockResolvedValueOnce({
        ...saved(),
        data: { ...saved().data, cancelled: 2, affected: BOOKINGS },
      });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    await screen.findByText("2 bookings fall outside the new hours");
    fireEvent.click(screen.getByRole("radio", { name: /Cancel and ask to rebook/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save and cancel 2" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect((mocks.save.mock.calls[1]?.[1] as Record<string, unknown>).affectedBookings).toEqual({
      choice: "cancel_and_rebook",
      bookingIds: ["b1", "b2"],
    });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Saved. 2 visits cancelled."));
  });

  it("shows the new list when more visits are affected than staff were shown, and sends nothing applied", async () => {
    const third = { ...BOOKINGS[0], bookingId: "b3", reference: "COL-1003" };
    mocks.save
      .mockResolvedValueOnce({
        ok: false,
        error: "x",
        errorCode: "bookings_affected",
        meta: { affected: BOOKINGS },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "x",
        errorCode: "bookings_affected",
        meta: { affected: [...BOOKINGS, third] },
      });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    await screen.findByText("2 bookings fall outside the new hours");
    fireEvent.click(screen.getByRole("button", { name: "Save and keep them" }));
    expect(await screen.findByText("3 bookings fall outside the new hours")).toBeTruthy();
    expect(screen.getByText("COL-1003")).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("keeps the bookings by default, and going back changes nothing", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: "x",
      errorCode: "bookings_affected",
      meta: { affected: BOOKINGS.slice(0, 1) },
    });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    await screen.findByText("1 booking falls outside the new hours");
    expect(screen.getByRole("button", { name: "Save and keep them" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() =>
      expect(screen.queryByText("1 booking falls outside the new hours")).toBeNull(),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(closesOnMonday().value).toBe("17:00");
  });

  it("offers a reload when someone else saved first, and keeps what was typed", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: "changed",
      errorCode: "settings_changed",
    });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("These settings changed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(closesOnMonday().value).toBe("17:00");
  });

  it("says nothing was saved when the save fails", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: "We couldn't reach the settings.",
      status: 503,
    });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("The settings weren't saved")).toBeTruthy();
    expect(screen.getByText("We couldn't reach the settings.")).toBeTruthy();
  });

  it("hands a stale sign-in to the step-up flow without showing an error", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(mocks.stepUp).toHaveBeenCalled());
    expect(screen.queryByText("The settings weren't saved")).toBeNull();
  });

  it("discards edits back to what was saved", () => {
    renderForm();
    fireEvent.change(closesOnMonday(), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(closesOnMonday().value).toBe("19:00");
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });
});
