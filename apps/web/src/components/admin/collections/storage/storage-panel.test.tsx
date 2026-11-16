import {
  STORAGE,
  STORAGE_EMPTY,
  STORAGE_SCHEDULED,
  STORAGE_VENUE,
  STORAGE_WITH_CHANGE,
} from "@/lib/admin/collections/storage.fixture";
import type { StaffStorageSettings } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  edit: vi.fn(),
  cancel: vi.fn(),
  charging: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  stepUp: vi.fn(() => false),
}));

vi.mock("@/lib/actions/admin/admin-collection-storage", () => ({
  scheduleStorageTermsAction: mocks.schedule,
  editStorageTermsAction: mocks.edit,
  cancelStorageTermsAction: mocks.cancel,
  setStorageChargingAction: mocks.charging,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({ handleStaffStepUp: mocks.stepUp }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: mocks.success, error: vi.fn() } }));

const { StoragePanel } = await import("./storage-panel");

const ok = (data: StaffStorageSettings) => ({ ok: true, data });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stepUp.mockReturnValue(false);
});

const renderPanel = (storage: StaffStorageSettings, canChange = true) =>
  render(<StoragePanel storage={storage} canChange={canChange} />);

const section = (name: string) => screen.getByRole("region", { name });

describe("Storage tab, charging off", () => {
  it("says charging is off, and does not claim buyers see the terms before they do", () => {
    renderPanel(STORAGE);
    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe(
      "Charging is offBuyers see the free period and the rates below, and the Not collected tab counts what would be due, but no storage invoice is raised. Finance can switch it on once the VAT treatment is confirmed.",
    );
  });

  it("shows the terms in force, since when, and the way to schedule a change", () => {
    renderPanel(STORAGE);
    const card = section("In force");
    expect(within(card).getByText("Since Sun 1 Nov")).toBeTruthy();
    expect(within(card).getByText("£3.00 per lot a day")).toBeTruthy();
    expect(
      within(card).getByText("£6.00 per lot a day · any side over 150 cm, marked on the lot"),
    ).toBeTruthy();
    expect(within(card).getByText("None")).toBeTruthy();
    expect(
      within(card).getByText("Lots won in sales that close on or after the start date"),
    ).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Schedule a change" })).toBeTruthy();
  });

  it("blocks the switch until a VAT treatment is chosen, keeping it focusable with the reason", () => {
    renderPanel(STORAGE);
    const card = section("Charging");
    const toggle = within(card).getByRole("switch", { name: /Raise storage invoices/ });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.hasAttribute("disabled")).toBe(false);
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    toggle.focus();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAccessibleDescription(
      "Can be switched on once Finance chooses a VAT treatment for storage charges with the accountant.",
    );
    fireEvent.click(toggle);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("gives the reason its own line, apart from the explanation", () => {
    renderPanel(STORAGE);
    const card = section("Charging");
    const reason = within(card).getByText(
      "Can be switched on once Finance chooses a VAT treatment for storage charges with the accountant.",
    );
    expect(reason.textContent).not.toContain("When on, a buyer");
  });

  it("lists the history: when, who, and the change as a plain sentence", () => {
    renderPanel(STORAGE);
    const table = within(section("History")).getByRole("table", { name: "History" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Fran Okafor");
    expect(rows[0]?.textContent).toContain(
      "Scheduled new terms from Sun 1 Nov: 14 calendar days free, £3.00 a day, £6.00 for large works, no handling fee.",
    );
    expect(rows[0]?.textContent).toContain("Reason: First terms, approved 1 Nov");
    expect(rows[1]?.textContent).toContain("System");
  });
});

describe("Storage tab, charging on", () => {
  it("drops the notice and shows the switch on", () => {
    renderPanel({ ...STORAGE, charging: { raiseInvoices: true, vatTreatment: "standard_rated" } });
    expect(screen.queryByText("Charging is off")).toBeNull();
    const toggle = within(section("Charging")).getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.hasAttribute("disabled")).toBe(false);
  });

  it("asks before switching, with a reason, then switches", async () => {
    const off = { raiseInvoices: true, vatTreatment: "standard_rated" as const };
    mocks.charging.mockResolvedValue(
      ok({ ...STORAGE, charging: { ...off, raiseInvoices: false } }),
    );
    renderPanel({ ...STORAGE, charging: off });
    fireEvent.click(within(section("Charging")).getByRole("switch"));
    const dialog = await screen.findByRole("dialog", { name: "Stop raising storage invoices?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch off" }));
    expect(await within(dialog).findByText("Enter why you're switching it.")).toBeTruthy();
    expect(mocks.charging).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Paused" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch off" }));
    await waitFor(() =>
      expect(mocks.charging).toHaveBeenCalledWith(STORAGE_VENUE, {
        raiseInvoices: false,
        reason: "Paused",
      }),
    );
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Storage invoices switched off"),
    );
    expect(screen.getByText("Charging is off")).toBeTruthy();
  });
});

describe("Storage tab, a change scheduled", () => {
  it("shows the change beside the terms in force, with its reason", () => {
    renderPanel(STORAGE_WITH_CHANGE);
    const card = section("Scheduled");
    expect(within(card).getAllByText("From Tue 1 Dec")[0]?.tagName).toBe("P");
    const table = within(card).getByRole("table", { name: "What changes" });
    const standard = within(table).getByRole("row", { name: /Standard/ });
    expect(standard.getAttribute("data-changes")).toBe("true");
    expect(standard.textContent).toContain("£3.00");
    expect(standard.textContent).toContain("£3.50");
    expect(within(table).getByRole("row", { name: /^Free/ }).getAttribute("data-changes")).toBe(
      "false",
    );
    expect(within(card).getByText("Reason: Rates for 2027, agreed with the gallery")).toBeTruthy();
    // The start is the card's heading, not a row that always reads as changed.
    expect(within(table).queryByRole("row", { name: /Starts on/ })).toBeNull();
  });

  it("puts Charging across the full width below In force and Scheduled", () => {
    renderPanel(STORAGE_WITH_CHANGE);
    expect(section("Charging").className).toContain("lg:col-span-2");
  });

  it("puts Charging beside In force when nothing is scheduled", () => {
    renderPanel(STORAGE);
    expect(section("Charging").className).not.toContain("lg:col-span-2");
  });

  it("says why another change cannot be scheduled while one waits", () => {
    renderPanel(STORAGE_WITH_CHANGE);
    const card = section("In force");
    const button = within(card).getByRole("button", { name: "Schedule a change" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // On the card as text too, not only in the tooltip: a phone has no hover (PRM-2).
    expect(
      within(card).getByText("A change is already scheduled. Edit or cancel it first."),
    ).toBeTruthy();
  });

  it("shows no reason line on In force when a change can be scheduled", () => {
    renderPanel(STORAGE);
    expect(within(section("In force")).queryByText(/already scheduled/)).toBeNull();
  });

  it("lets cards that share a row stretch to one bottom edge", () => {
    renderPanel(STORAGE_WITH_CHANGE);
    const grid = section("In force").parentElement;
    expect(grid?.className).toContain("grid");
    expect(grid?.className).not.toContain("items-start");
  });

  it("cancels the change after an in-page confirmation with a reason", async () => {
    mocks.cancel.mockResolvedValue(ok(STORAGE));
    renderPanel(STORAGE_WITH_CHANGE);
    fireEvent.click(within(section("Scheduled")).getByRole("button", { name: "Cancel change" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel the change from Tue 1 Dec?" });
    expect(dialog.textContent).toContain("The terms in force stay as they are.");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Wrong date" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel change" }));
    await waitFor(() =>
      expect(mocks.cancel).toHaveBeenCalledWith(STORAGE_VENUE, STORAGE_SCHEDULED.id, {
        reason: "Wrong date",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", { name: "Scheduled" })).toBeNull());
    expect(mocks.success).toHaveBeenCalledWith("Scheduled change cancelled");
  });

  it("keeps the change when the person backs out", async () => {
    renderPanel(STORAGE_WITH_CHANGE);
    fireEvent.click(within(section("Scheduled")).getByRole("button", { name: "Cancel change" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep change" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(section("Scheduled")).toBeTruthy();
  });

  it("opens the change for editing, starting from its values", async () => {
    renderPanel(STORAGE_WITH_CHANGE);
    fireEvent.click(within(section("Scheduled")).getByRole("button", { name: "Edit" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit the scheduled change" });
    expect((within(sheet).getByLabelText("Standard") as HTMLInputElement).value).toBe("3.50");
    expect((within(sheet).getByLabelText("Reason") as HTMLTextAreaElement).value).toBe(
      STORAGE_SCHEDULED.reason,
    );
    expect(within(sheet).getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
});

describe("Storage tab, no terms yet", () => {
  it("says what buyers are told until terms are set, and offers to set them", async () => {
    renderPanel(STORAGE_EMPTY);
    expect(screen.getByRole("heading", { name: "No storage terms set" })).toBeTruthy();
    expect(
      screen.getByText(
        "Until you set them, buyers are asked to collect within 30 days and told charges may apply. Nothing is charged.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Charging is off")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set storage terms" }));
    expect(await screen.findByRole("dialog", { name: "Schedule a change" })).toBeTruthy();
  });

  it("offers nothing to someone who may only look", () => {
    renderPanel(STORAGE_EMPTY, false);
    expect(screen.queryByRole("button", { name: "Set storage terms" })).toBeNull();
  });
});

describe("Storage tab, read-only (Fulfilment)", () => {
  it("shows the terms with no actions, and the switch as text", () => {
    renderPanel(STORAGE_WITH_CHANGE, false);
    expect(screen.queryByRole("button", { name: "Schedule a change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel change" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    const card = section("Charging");
    expect(within(card).getByText("Raise storage invoices")).toBeTruthy();
    expect(within(card).getByText("Off")).toBeTruthy();
  });
});

describe("Storage tab, switching charging on", () => {
  const ready = { raiseInvoices: false, vatTreatment: "standard_rated" as const };

  it("asks for a reason in the page, then switches on", async () => {
    mocks.charging.mockResolvedValue(
      ok({ ...STORAGE, charging: { ...ready, raiseInvoices: true } }),
    );
    renderPanel({ ...STORAGE, charging: ready });
    const toggle = within(section("Charging")).getByRole("switch");
    expect(toggle.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(toggle);
    const dialog = await screen.findByRole("dialog", { name: "Raise storage invoices?" });
    expect(dialog.textContent).toContain("is sent a storage invoice");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "VAT agreed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch on" }));
    await waitFor(() =>
      expect(mocks.charging).toHaveBeenCalledWith(STORAGE_VENUE, {
        raiseInvoices: true,
        reason: "VAT agreed",
      }),
    );
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Storage invoices switched on"));
    expect(screen.queryByText("Charging is off")).toBeNull();
    expect(within(section("Charging")).getByRole("switch").getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});

describe("Storage tab, when a change fails", () => {
  const refused = (error: string) => ({ ok: false, error, errorCode: "not_scheduled" });

  it("says a cancel was not saved, and keeps the change", async () => {
    mocks.cancel.mockResolvedValue(refused("This change has already started or was cancelled."));
    renderPanel(STORAGE_WITH_CHANGE);
    fireEvent.click(within(section("Scheduled")).getByRole("button", { name: "Cancel change" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Wrong date" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel change" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The change wasn't saved");
    expect(alert.textContent).toContain("This change has already started or was cancelled.");
    expect(section("Scheduled")).toBeTruthy();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("says a switch was not saved", async () => {
    mocks.charging.mockResolvedValue(refused("Storage invoices can be switched on once…"));
    renderPanel({ ...STORAGE, charging: { raiseInvoices: true, vatTreatment: "exempt" } });
    fireEvent.click(within(section("Charging")).getByRole("switch"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Pause" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch off" }));
    expect((await screen.findByRole("alert")).textContent).toContain("The change wasn't saved");
  });

  it("drops the old failure once a later change goes through", async () => {
    mocks.cancel.mockResolvedValueOnce(refused("Try again."));
    mocks.cancel.mockResolvedValueOnce(ok(STORAGE));
    renderPanel(STORAGE_WITH_CHANGE);
    const cancelOnce = async () => {
      fireEvent.click(within(section("Scheduled")).getByRole("button", { name: "Cancel change" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Wrong date" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel change" }));
    };
    await cancelOnce();
    expect((await screen.findByRole("alert")).textContent).toContain("Try again.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await cancelOnce();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Scheduled change cancelled"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("The change wasn't saved")).toBeNull();
  });
});
