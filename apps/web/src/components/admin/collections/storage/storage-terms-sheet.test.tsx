import {
  STORAGE,
  STORAGE_IN_FORCE,
  STORAGE_TODAY,
  STORAGE_VENUE,
  STORAGE_WITH_CHANGE,
} from "@/lib/admin/collections/storage.fixture";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  edit: vi.fn(),
  refresh: vi.fn(),
  stepUp: vi.fn(() => false),
}));

vi.mock("@/lib/actions/admin/admin-collection-storage", () => ({
  scheduleStorageTermsAction: mocks.schedule,
  editStorageTermsAction: mocks.edit,
  cancelStorageTermsAction: vi.fn(),
  setStorageChargingAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: mocks.stepUp }));

const { StorageTermsSheet } = await import("./storage-terms-sheet");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepUp.mockReturnValue(false);
});

function open(over: Partial<Parameters<typeof StorageTermsSheet>[0]> = {}) {
  const props = {
    onClose: vi.fn(),
    onSaved: vi.fn(),
    venueId: STORAGE_VENUE,
    today: STORAGE_TODAY,
    inForce: STORAGE_IN_FORCE,
    editing: null,
    ...over,
  };
  render(<StorageTermsSheet {...props} />);
  return { props, sheet: screen.getByRole("dialog", { name: "Schedule a change" }) };
}

/** The field by its label; "Handling fee" also names its section, so fields are found by role. */
const field = (sheet: HTMLElement, label: string) =>
  within(sheet).getByRole("textbox", { name: new RegExp(`^${label}`) });

const type = (sheet: HTMLElement, label: string, value: string) =>
  fireEvent.change(field(sheet, label), { target: { value } });

/** Types a date the way staff do: the text, then leaving the field. */
function setStart(sheet: HTMLElement, text: string) {
  const input = within(sheet).getByLabelText("Starts on");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
}

describe("Schedule a change", () => {
  it("has the four sections and starts from the terms in force", () => {
    const { sheet } = open();
    for (const name of [
      "When it starts",
      "Free storage",
      "Daily charge after that",
      "Handling fee",
    ]) {
      expect(within(sheet).getByRole("heading", { name })).toBeTruthy();
    }
    expect((within(sheet).getByLabelText("Free days") as HTMLInputElement).value).toBe("14");
    expect(
      within(sheet)
        .getByRole("radio", { name: "Calendar days (Recommended)" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect((within(sheet).getByLabelText("Standard") as HTMLInputElement).value).toBe("3.00");
    expect((within(sheet).getByLabelText("Large") as HTMLInputElement).value).toBe("6.00");
  });

  it("shows what buyers will read, from the buyer formatter, as staff type", () => {
    const { sheet } = open();
    type(sheet, "Standard", "3.50");
    type(sheet, "Large", "7");
    expect(within(sheet).getByText("Buyers will read").parentElement?.textContent).toContain(
      "Storage is free for 14 days after your payment clears. After that it is £3.50 a day for each work, or £7.00 for works over 150 cm on any side, plus VAT where it applies.",
    );
    type(sheet, "Free days", "");
    expect(
      within(sheet).getByText("Fill in the free days and rates to see what buyers will read."),
    ).toBeTruthy();
  });

  it("drops the large rate when the large band is turned off", () => {
    const { sheet } = open();
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /Large band/ }));
    expect(within(sheet).queryByLabelText("Large")).toBeNull();
    expect(sheet.textContent).toContain(
      "After that it is £3 a day for each work, plus VAT where it applies.",
    );
  });

  it("lists two or more problems in a summary that links to each field, and inline", async () => {
    const { sheet } = open();
    type(sheet, "Free days", "91");
    type(sheet, "Large", "");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    const summary = await within(sheet).findByRole("alert");
    expect(within(summary).getByText("4 things to fix")).toBeTruthy();
    const links = within(summary)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(links).toEqual([
      "Choose a date from tomorrow",
      "Enter a reason",
      "Enter a number of days from 0 to 90",
      "Enter a daily rate, or turn off the large band",
    ]);
    const freeDays = within(sheet).getByLabelText("Free days");
    expect(freeDays.getAttribute("aria-invalid")).toBe("true");
    expect(freeDays).toHaveAccessibleDescription(
      expect.stringContaining("Enter a number of days from 0 to 90"),
    );
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("refuses a large band of £0.00, asking for a rate or to turn the band off", async () => {
    const { sheet } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates");
    type(sheet, "Large", "0");
    expect(
      within(sheet).getByText("Fill in the free days and rates to see what buyers will read."),
    ).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    expect(
      await within(sheet).findByText("Enter a daily rate, or turn off the large band"),
    ).toBeTruthy();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("says how far ahead a change may start, and refuses a later date", async () => {
    const { sheet } = open();
    const start = within(sheet).getByLabelText("Starts on");
    expect(start).toHaveAccessibleDescription(
      expect.stringContaining("From tomorrow, up to Wed 15 Nov 2028."),
    );
    expect(start.getAttribute("placeholder")).toBe("e.g. 16 Nov 2026");
    setStart(sheet, "1 Dec 2062");
    type(sheet, "Reason", "Rates");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    expect(await within(sheet).findByText("Choose a date up to Wed 15 Nov 2028")).toBeTruthy();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("gives the Standard and Large rates the same width: neither sits in a half-width row", () => {
    const { sheet } = open();
    for (const label of ["Standard", "Large"]) {
      expect(within(sheet).getByLabelText(label).closest(".sm\\:grid-cols-2")).toBeNull();
    }
  });

  it("speaks the preview once typing pauses, not on every keystroke", () => {
    vi.useFakeTimers();
    try {
      const { sheet } = open();
      const announcer = within(sheet).getByTestId("storage-preview-announcer");
      // An <output> is a polite status region.
      expect(announcer.tagName).toBe("OUTPUT");
      const first = announcer.textContent;
      type(sheet, "Standard", "3.5");
      type(sheet, "Standard", "3.50");
      expect(announcer.textContent).toBe(first);
      act(() => vi.advanceTimersByTime(1000));
      expect(announcer.textContent).toContain("£3.50 a day for each work");
      // The visible preview itself is not a live region.
      expect(within(sheet).getByRole("note", { name: "Buyers will read" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes straight to the field with one problem, without a summary", async () => {
    const { sheet } = open();
    setStart(sheet, "1 Dec 2026");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(sheet).getByLabelText("Reason")),
    );
    expect(within(sheet).queryByText(/things? to fix/)).toBeNull();
    expect(within(sheet).getByText("Enter a reason")).toBeTruthy();
  });

  it("refuses an amount over £500.00", async () => {
    const { sheet } = open();
    type(sheet, "Standard", "500.01");
    type(sheet, "Handling fee", "-1");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    const summary = await within(sheet).findByRole("alert");
    expect(
      within(summary)
        .getAllByRole("link")
        .filter((link) => link.textContent === "Enter an amount up to £500.00"),
    ).toHaveLength(2);
  });

  it("sends the change once, shows it is saving, and hands the result back", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.schedule.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { sheet, props } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates for 2027");
    type(sheet, "Standard", "3.50");
    type(sheet, "Handling fee", "");
    const submit = within(sheet).getByRole("button", { name: "Schedule change" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(submit.getAttribute("aria-busy")).toBe("true"));
    expect(mocks.schedule).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).toHaveBeenCalledWith(STORAGE_VENUE, {
      effectiveFrom: "2026-12-01",
      reason: "Rates for 2027",
      freeDays: 14,
      countMode: "calendar",
      standardDailyPence: 350,
      largeDailyPence: 600,
      handlingFeePence: 0,
    });
    finish({ ok: true, data: STORAGE_WITH_CHANGE });
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(STORAGE_WITH_CHANGE));
  });

  it("shows the API's refusal of the date under the field", async () => {
    mocks.schedule.mockResolvedValue({
      ok: false,
      error: "Choose a date from tomorrow.",
      errorCode: "start_not_in_future",
      meta: { issues: [{ field: "effectiveFrom", message: "Choose a date from tomorrow." }] },
    });
    const { sheet, props } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText("Starts on").getAttribute("aria-invalid")).toBe("true"),
    );
    expect(within(sheet).getByText("Choose a date from tomorrow")).toBeTruthy();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("shows the API's refusal of a date too far ahead in the form's words", async () => {
    mocks.schedule.mockResolvedValue({
      ok: false,
      error: "Choose a date within the next 2 years.",
      errorCode: "start_too_late",
      meta: {
        issues: [{ field: "effectiveFrom", message: "Choose a date within the next 2 years." }],
      },
    });
    const { sheet } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    expect(await within(sheet).findByText("Choose a date up to Wed 15 Nov 2028")).toBeTruthy();
  });

  it("says why any other refusal happened, and keeps what was typed", async () => {
    mocks.schedule.mockResolvedValue({
      ok: false,
      error: "A change is already scheduled. Edit it or cancel it before scheduling another.",
      errorCode: "change_already_scheduled",
    });
    const { sheet } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    expect(await within(sheet).findByText("The change wasn't saved")).toBeTruthy();
    expect((within(sheet).getByLabelText("Reason") as HTMLTextAreaElement).value).toBe("Rates");
  });

  it("asks before throwing away changes on Cancel", async () => {
    const { sheet, props } = open();
    type(sheet, "Reason", "Half typed");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard changes to the storage terms?")).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("closes at once on Cancel when nothing was changed", async () => {
    const { sheet, props } = open();
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("does not resend when the sign-in must be confirmed again", async () => {
    mocks.stepUp.mockReturnValue(true);
    mocks.schedule.mockResolvedValue({ ok: false, error: "step_up_required" });
    const { sheet, props } = open();
    setStart(sheet, "1 Dec 2026");
    type(sheet, "Reason", "Rates");
    fireEvent.click(within(sheet).getByRole("button", { name: "Schedule change" }));
    await waitFor(() => expect(mocks.stepUp).toHaveBeenCalled());
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(within(sheet).queryByText("The change wasn't saved")).toBeNull();
  });
});

describe("Edit the scheduled change", () => {
  it("sends the edit to the scheduled change", async () => {
    mocks.edit.mockResolvedValue({ ok: true, data: STORAGE });
    const editing = STORAGE_WITH_CHANGE.scheduled;
    if (!editing) throw new Error("fixture");
    render(
      <StorageTermsSheet
        onClose={vi.fn()}
        onSaved={vi.fn()}
        venueId={STORAGE_VENUE}
        today={STORAGE_TODAY}
        inForce={STORAGE_IN_FORCE}
        editing={editing}
      />,
    );
    const sheet = screen.getByRole("dialog", { name: "Edit the scheduled change" });
    type(sheet, "Standard", "4");
    fireEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith(
        STORAGE_VENUE,
        editing.id,
        expect.objectContaining({ standardDailyPence: 400, effectiveFrom: "2026-12-01" }),
      ),
    );
  });
});
