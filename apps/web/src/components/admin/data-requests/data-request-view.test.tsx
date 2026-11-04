import {
  closedRecord,
  downloadRecord,
  extendedRecord,
  manualRecord,
  ownRecord,
  waitingRecord,
} from "@/lib/admin/data-requests/data-request.fixture";
import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataRequestView, type DataRequestViewProps } from "./data-request-view";

const push = vi.fn();
const refresh = vi.fn();
const patch = vi.fn();
const extend = vi.fn();
const close = vi.fn();
const continueManually = vi.fn();
const undo = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn() }),
  usePathname: () => "/admin/compliance/data-requests/DR-0012",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-data-requests", () => ({
  patchDataRequestAction: (...args: unknown[]) => patch(...args),
  extendDataRequestAction: (...args: unknown[]) => extend(...args),
  closeDataRequestAction: (...args: unknown[]) => close(...args),
  continueDataRequestAction: (...args: unknown[]) => continueManually(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@auction/staff-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/staff-ui")>()),
  toastUndo: (input: { onUndo: () => void }) => undo(input),
}));

const LIST = "/admin/compliance/data-requests?view=open";

function renderView(record: DataRequestRecord, patchProps: Partial<DataRequestViewProps> = {}) {
  return render(
    <StaffTooltipProvider>
      <DataRequestView
        record={record}
        today="2026-11-02"
        listHref={LIST}
        pager={{
          position: 1,
          total: 7,
          previousHref: null,
          nextHref: "/admin/compliance/data-requests/DR-0014",
        }}
        initialAction={null}
        {...patchProps}
      />
    </StaffTooltipProvider>,
  );
}

const withRecord = (record: DataRequestRecord, version = record.version + 1) => ({
  ok: true,
  data: { ...record, version },
});

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue(withRecord(manualRecord));
});

describe("DataRequestView: an overdue manual request", () => {
  it("shows the status, the missed deadline and the facts", () => {
    renderView(manualRecord);
    expect(screen.getByRole("heading", { level: 1, name: "DR-0012" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getAllByText("1 day overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("This request is 1 day past its legal due date")).toBeInTheDocument();
    expect(document.body.textContent).toContain("margaret.osei@outlook.co.uk");
    expect(screen.getByText(/Opening this record is logged/)).toBeInTheDocument();
  });

  it("draws the time-allowed meter in the danger tone once the request is overdue", () => {
    renderView(manualRecord);
    const meter = screen.getByRole("progressbar", { name: "Time allowed used" });
    expect(meter.firstElementChild).toHaveAttribute("data-tone", "danger");
  });

  it("makes Close with outcome the primary action and disables Extend with its reason", () => {
    renderView(manualRecord);
    expect(screen.getByRole("button", { name: "Close with outcome…" })).toBeEnabled();
    const extendButton = screen.getByRole("button", { name: "Extend…" });
    expect(extendButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.focus(extendButton);
    expect(
      screen.getAllByText(/The original due date, 1 Nov 2026, has passed/).length,
    ).toBeGreaterThan(0);
  });

  it("shows the pager and links back to the list the request was opened from", () => {
    renderView(manualRecord);
    expect(screen.getByRole("link", { name: "Data requests" })).toHaveAttribute("href", LIST);
    expect(screen.getByRole("link", { name: "Next request" })).toHaveAttribute(
      "href",
      "/admin/compliance/data-requests/DR-0014",
    );
  });

  it("shows no pager when it was opened without a list", () => {
    renderView(manualRecord, { pager: null });
    expect(screen.queryByRole("navigation", { name: "Position in list" })).not.toBeInTheDocument();
  });
});

describe("DataRequestView: products to gather", () => {
  it("marks a product gathered and offers Undo for 10 seconds", async () => {
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Mark gathered" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("DR-0012", {
        gathered: { product: "shop", done: true },
        version: 4,
      }),
    );
    await waitFor(() => expect(undo).toHaveBeenCalled());
    expect(undo.mock.calls[0]?.[0]).toMatchObject({
      title: "LAX Shop and lax.art marked gathered",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("sends the newer version when the mark is undone, so Undo is not taken for a stale edit", async () => {
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Mark gathered" }));
    await waitFor(() => expect(undo).toHaveBeenCalled());
    undo.mock.calls[0]?.[0].onUndo();
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]).toEqual([
      "DR-0012",
      { gathered: { product: "shop", done: false }, version: 5 },
    ]);
  });

  it("unmarks a gathered product", async () => {
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Unmark" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("DR-0012", {
        gathered: { product: "bid", done: false },
        version: 4,
      }),
    );
  });

  it("explains why nothing can be gathered while waiting for ID", () => {
    renderView(waitingRecord);
    const mark = screen.getByRole("button", { name: "Mark gathered" });
    expect(mark).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "ID received on…" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Close with outcome…" })).toBeInTheDocument();
  });
});

describe("DataRequestView: notes", () => {
  it("keeps the typed text and offers a reload when the request changed under the editor", async () => {
    patch.mockResolvedValue({
      ok: false,
      error: "changed",
      errorCode: "stale_version",
      status: 409,
    });
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(box, { target: { value: "New note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
    await screen.findByText("This request changed");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("New note");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("says nothing was changed when a save fails for another reason", async () => {
    patch.mockResolvedValue({
      ok: false,
      error: "Identity didn't answer. Nothing was changed. Try again in a moment.",
      status: 503,
    });
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
    expect(await screen.findByText("The note wasn't saved")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument();
  });
});

describe("DataRequestView: close", () => {
  it("states the effect, names the late flag and confirms with its own label", async () => {
    close.mockResolvedValue(withRecord(manualRecord));
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Close with outcome…" }));
    const dialog = screen.getByRole("dialog", { name: "Close DR-0012 with an outcome" });
    expect(within(dialog).getByText("This will be recorded as 1 day late")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Copy sent" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close request" }));
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith("DR-0012", { outcome: "sent", version: 4 }),
    );
  });

  it("checks on submit and lists what to fix, without losing input", async () => {
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Close with outcome…" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close request" }));
    expect(await within(dialog).findAllByText("Choose an outcome.")).toHaveLength(2);
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Refused as manifestly unfounded or excessive" }),
    );
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Why/ }), {
      target: { value: "Repeated 14 times" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close as refused" }));
    expect(
      await within(dialog).findAllByText("Confirm the person was told before closing."),
    ).not.toHaveLength(0);
    expect(close).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("textbox", { name: /Why/ })).toHaveValue("Repeated 14 times");
  });

  it("keeps the dialog open and says nothing was changed when Identity does not answer", async () => {
    close.mockResolvedValue({
      ok: false,
      error: "Identity didn't answer. Nothing was changed. Try again in a moment.",
      status: 503,
    });
    renderView(manualRecord);
    fireEvent.click(screen.getByRole("button", { name: "Close with outcome…" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Copy sent" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close request" }));
    expect(await within(dialog).findByText("The request couldn't be closed")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("only offers a refusal or withdrawal while the clock has not started", () => {
    renderView(waitingRecord);
    fireEvent.click(screen.getByRole("button", { name: "Close with outcome…" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: /^Copy sent(?!,)/ })).toBeDisabled();
    expect(within(dialog).getByRole("radio", { name: "Withdrawn by the person" })).toBeEnabled();
  });
});

describe("DataRequestView: extend and ID received", () => {
  it("opens Extend on a request still inside its date, naming both new dates", () => {
    const soon = {
      ...manualRecord,
      request: {
        ...manualRecord.request,
        dueOn: "2026-11-09",
        due: { state: "due_soon" as const, daysLeft: 7 },
      },
    };
    renderView(soon as DataRequestRecord);
    fireEvent.click(screen.getByRole("button", { name: "Extend…" }));
    const dialog = screen.getByRole("dialog", { name: "Extend DR-0012?" });
    expect(
      within(dialog).getByText(/New due date 9 Jan 2027, the most the law allows/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Extend to 9 Jan 2027" }),
    ).toBeInTheDocument();
  });

  it("starts the clock from the day the proof arrived", async () => {
    patch.mockResolvedValue(withRecord(waitingRecord));
    renderView(waitingRecord);
    fireEvent.click(screen.getByRole("button", { name: "ID received on…" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Due/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Start the clock" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("DR-0016", { idReceivedOn: "2026-11-02", version: 4 }),
    );
  });
});

describe("DataRequestView: an automatic download", () => {
  it("has no primary action, only Continue manually, and shows progress without a file link", () => {
    renderView(downloadRecord);
    expect(screen.getByRole("heading", { level: 1, name: "DL-7F3C1A" })).toBeInTheDocument();
    expect(screen.getByText("Delayed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close with outcome…" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue manually…" })).toBeEnabled();
    expect(screen.getByText("Shop hasn't answered")).toBeInTheDocument();
    expect(screen.getByText("Not built yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });

  it("states what continuing creates, then opens the new request", async () => {
    continueManually.mockResolvedValue(
      withRecord({ ...manualRecord, request: { ...manualRecord.request, reference: "DR-0018" } }),
    );
    renderView(downloadRecord);
    fireEvent.click(screen.getByRole("button", { name: "Continue manually…" }));
    const dialog = screen.getByRole("dialog", { name: "Continue DL-7F3C1A manually?" });
    expect(within(dialog).getByText("A new manual request")).toBeInTheDocument();
    expect(within(dialog).getByText(/leaves the Open view/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue manually" }));
    await waitFor(() => expect(continueManually).toHaveBeenCalledWith("DL-7F3C1A"));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/compliance/data-requests/DR-0018"),
    );
  });
});

describe("DataRequestView: view only on your own request", () => {
  it("shows the same facts with no action and the reason", () => {
    renderView(ownRecord);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.getByText("This request is about you")).toBeInTheDocument();
    expect(screen.getByText(/Another person must handle a request about you/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue manually…" })).not.toBeInTheDocument();
  });

  it("offers no action on your own manual request either", () => {
    renderView({ ...manualRecord, ownRequest: true });
    for (const name of ["Close with outcome…", "Extend…", "Mark gathered", "Unmark", "Edit"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

describe("DataRequestView: other states", () => {
  it("shows a closed request's outcome and timeliness with no actions", () => {
    renderView(closedRecord);
    expect(screen.getByText("Closed: We hold nothing about them")).toBeInTheDocument();
    expect(screen.getByText(/Answered 3 days late/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close with outcome…" })).not.toBeInTheDocument();
  });

  it("shows an extended request's new date and when the person was told", () => {
    renderView(extendedRecord);
    expect(screen.getAllByText("18 Dec 2026").length).toBeGreaterThan(0);
    expect(screen.getByText("18 Oct 2026 to 18 Dec 2026")).toBeInTheDocument();
    expect(screen.getByText("10 Oct 2026 by post")).toBeInTheDocument();
  });

  it("opens a dialog the list's row menu asked for, when it is allowed", () => {
    renderView(manualRecord, { initialAction: "close" });
    expect(
      screen.getByRole("dialog", { name: "Close DR-0012 with an outcome" }),
    ).toBeInTheDocument();
  });

  it("does not open Extend from the row menu when it is blocked", () => {
    renderView(manualRecord, { initialAction: "extend" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
