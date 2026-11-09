import {
  DESK_BOOKING,
  DESK_LOT_A,
  DESK_LOT_B,
  deskBooking,
  deskLot,
} from "@/lib/admin/collections/desk.fixture";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const handOver = vi.fn();
const undo = vi.fn();
const release = vi.fn();
vi.mock("@/lib/actions/admin/admin-collection-desk", () => ({
  handOverCollectionAction: (...a: unknown[]) => handOver(...a),
  undoHandOverCollectionAction: (...a: unknown[]) => undo(...a),
}));
vi.mock("@/lib/actions/admin/admin-lot-fulfilment", () => ({
  adminLotFulfilmentReleaseResultAction: (...a: unknown[]) => release(...a),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  handleStaffStepUp: (failure: { errorCode?: string }) => failure.errorCode === "step_up_required",
}));

const toastUndo = vi.fn();
const toastError = vi.fn();
vi.mock("@auction/staff-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@auction/staff-ui")>();
  return {
    ...actual,
    toastUndo: (...a: unknown[]) => toastUndo(...a),
    toast: { ...actual.toast, error: (...a: unknown[]) => toastError(...a) },
  };
});

const { DeskHandOverPanel } = await import("./desk-hand-over-panel");

const draw = (booking = deskBooking(), onClose = vi.fn()) => {
  render(<DeskHandOverPanel booking={booking} onClose={onClose} />);
  return onClose;
};

const confirm = () => screen.getByRole("button", { name: /^Mark .* collected$/ });

async function chooseIdType(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: /Type of ID/ }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Radix Select scrolls the chosen option into view, which jsdom does not implement.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

describe("the hand-over panel", () => {
  it("names who is collecting and lists the lots, all ticked", () => {
    draw();
    expect(screen.getByRole("heading", { name: "Hand over to Charlotte Hayes" })).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", { name: /Coastal Notation/ }) as HTMLElement).getAttribute(
        "data-state",
      ),
    ).toBe("checked");
    expect(confirm().textContent).toBe("Mark 2 lots collected");
  });

  it("is off until every ticked lot is released, says why, and offers Release in place", async () => {
    release.mockResolvedValue({ ok: true });
    const waiting = deskBooking({
      lots: [
        deskLot({ released: false, fulfilmentStatus: "awaiting_release" }),
        deskLot({ lotId: DESK_LOT_B, title: "Lowland Storm", lotNumber: 9 }),
      ],
    });
    draw(waiting);
    expect(confirm().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Release first")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(DESK_LOT_A, {}));
    expect(refresh).toHaveBeenCalled();
  });

  it("lets staff leave the unreleased lot behind", () => {
    const waiting = deskBooking({
      lots: [
        deskLot({ released: false, fulfilmentStatus: "awaiting_release" }),
        deskLot({ lotId: DESK_LOT_B, title: "Lowland Storm", lotNumber: 9 }),
      ],
    });
    draw(waiting);
    fireEvent.click(screen.getByRole("checkbox", { name: /Coastal Notation/ }));
    expect(confirm().getAttribute("aria-disabled")).toBeNull();
    expect(confirm().textContent).toBe("Mark Lowland Storm collected");
  });

  it("asks for the ID check and its type, in a summary and under each field, before sending", async () => {
    draw();
    fireEvent.click(confirm());
    const summary = await screen.findByRole("alert");
    expect(summary.textContent).toContain("Check 2 things before handing over");
    expect(screen.getAllByText("Tick this once you've checked their ID.").length).toBeGreaterThan(
      1,
    );
    expect(screen.getAllByText("Choose the type of ID.").length).toBeGreaterThan(1);
    expect(handOver).not.toHaveBeenCalled();
  });

  it("hands over the ticked lots with the ID type and one attempt key, then closes", async () => {
    handOver.mockResolvedValue({ ok: true, data: deskBooking({ status: "collected" }) });
    const onClose = draw();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Passport");
    fireEvent.click(confirm());
    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(1));
    const [bookingId, body, key] = handOver.mock.calls[0] as [string, unknown, string];
    expect(bookingId).toBe(DESK_BOOKING);
    expect(body).toEqual({
      lotIds: [DESK_LOT_A, DESK_LOT_B],
      idCheck: { confirmed: true, type: "passport" },
    });
    expect(key.length).toBeGreaterThanOrEqual(8);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it("names the lots and who collected them in the toast", async () => {
    handOver.mockResolvedValue({ ok: true, data: deskBooking({ status: "collected" }) });
    draw();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Passport");
    fireEvent.click(confirm());
    await waitFor(() => expect(toastUndo).toHaveBeenCalledTimes(1));
    expect(toastUndo.mock.calls[0]?.[0]).toMatchObject({
      title: "Coastal Notation and Lowland Storm collected by Charlotte Hayes",
    });
  });

  it("shows a toast, not a hidden message, when the undo from the toast is refused", async () => {
    handOver.mockResolvedValue({ ok: true, data: deskBooking({ status: "collected" }) });
    undo.mockResolvedValue({
      ok: false,
      error: "late",
      errorCode: "undo_window_passed",
      status: 409,
    });
    draw();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Passport");
    fireEvent.click(confirm());
    await waitFor(() => expect(toastUndo).toHaveBeenCalled());
    (toastUndo.mock.calls[0]?.[0] as { onUndo: () => void }).onUndo();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("It's too late to undo this hand-over."),
    );
  });

  it("sees a lot released from inside the panel, and then hands both over", async () => {
    release.mockResolvedValue({ ok: true });
    handOver.mockResolvedValue({ ok: true, data: deskBooking({ status: "collected" }) });
    const waiting = deskBooking({
      lots: [
        deskLot({ released: false, fulfilmentStatus: "awaiting_release" }),
        deskLot({ lotId: DESK_LOT_B, title: "Lowland Storm", lotNumber: 9 }),
      ],
    });
    const onClose = vi.fn();
    const { rerender } = render(<DeskHandOverPanel booking={waiting} onClose={onClose} />);
    expect(confirm().getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(DESK_LOT_A, {}));
    // The page reloads after the release: the same visit comes back with the lot released.
    rerender(<DeskHandOverPanel booking={deskBooking()} onClose={onClose} />);
    expect(confirm().getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText("Release first")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Passport");
    fireEvent.click(confirm());
    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(1));
    expect(handOver.mock.calls[0]?.[1]).toMatchObject({ lotIds: [DESK_LOT_A, DESK_LOT_B] });
  });

  it("shows the refusal when a check opened after the booking, and stays open", async () => {
    handOver.mockResolvedValue({
      ok: false,
      error: "A check opened",
      errorCode: "hold_open",
      status: 409,
    });
    const onClose = draw();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Driving licence");
    fireEvent.click(confirm());
    expect(await screen.findByText(/A check has opened on this purchase/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a new key for a new attempt after a refusal", async () => {
    handOver.mockResolvedValue({ ok: false, error: "No", errorCode: "not_released", status: 409 });
    draw();
    fireEvent.click(screen.getByRole("checkbox", { name: /I checked photo ID/ }));
    await chooseIdType("Passport");
    fireEvent.click(confirm());
    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(1));
    fireEvent.click(confirm());
    await waitFor(() => expect(handOver).toHaveBeenCalledTimes(2));
    expect(handOver.mock.calls[0]?.[2]).not.toBe(handOver.mock.calls[1]?.[2]);
  });

  it("notes a third-party collector and who authorised them", () => {
    draw(
      deskBooking({
        collector: { kind: "third_party", name: "Sam Shipper", company: "Fast Freight Ltd" },
      }),
    );
    const note = screen.getByText("A third party is collecting").closest("[data-tone]");
    expect(note).toBeTruthy();
    expect(within(note as HTMLElement).getByText(/authorised Sam Shipper/)).toBeTruthy();
  });

  it("never asks for an ID number", () => {
    draw();
    expect(screen.queryByLabelText(/number/i)).toBeNull();
    expect(screen.getByText(/Never the number, and we don't keep a copy/)).toBeTruthy();
  });
});
