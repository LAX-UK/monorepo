// @vitest-environment jsdom
import type { AdminOrderDetail } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateFulfilment = vi.fn();
const recordFulfilmentPossession = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({
  updateFulfilment,
  recordFulfilmentPossession,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/orders/o-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { FulfilmentSection } = await import("./fulfilment-section.client");

type Fulfilment = NonNullable<AdminOrderDetail["fulfilmentRecord"]>;

const record = (overrides: Partial<Fulfilment>): Fulfilment => ({
  fulfilmentId: "11111111-1111-4111-8111-111111111111",
  status: "awaiting_dispatch",
  option: "uk_insured_delivery",
  carrier: null,
  trackingNumber: null,
  possessionAt: null,
  updatedAt: "2026-10-20T09:00:00.000Z",
  ...overrides,
});

const PAID = "2026-10-01T09:00:00.000Z";

function renderSection(fulfilment: Fulfilment | null, canEdit = true) {
  return render(
    <FulfilmentSection
      fulfilment={fulfilment}
      fallbackOption="uk_insured_delivery"
      paidAt={PAID}
      canEdit={canEdit}
    />,
  );
}

const offered = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);

function choose(label: string) {
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: label }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
  updateFulfilment.mockReset();
  recordFulfilmentPossession.mockReset();
  refresh.mockReset();
  updateFulfilment.mockResolvedValue({ ok: true, data: { id: "x", status: "in_transit" } });
  recordFulfilmentPossession.mockResolvedValue({
    ok: true,
    data: { id: "x", status: "delivered" },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the fulfilment section", () => {
  it("shows the facts, in words, with an Edit button for roles that can change fulfilment", () => {
    renderSection(record({ carrier: "Royal Mail", trackingNumber: "AB123", status: "in_transit" }));
    const section = screen.getByRole("region", { name: "Fulfilment" });
    expect(within(section).getByText("In transit")).toBeInTheDocument();
    expect(within(section).getByText("UK insured delivery")).toBeInTheDocument();
    expect(within(section).getByText("Royal Mail AB123")).toBeInTheDocument();
    expect(within(section).getByText("Not recorded")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows view-only roles the facts with no Edit and no form", () => {
    renderSection(record({}), false);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("explains an end state instead of offering Edit", () => {
    renderSection(record({ status: "delivered", possessionAt: "2026-10-20T10:00:00.000Z" }));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText(/Delivered is final/)).toBeInTheDocument();
  });

  it("says fulfilment starts once the order is paid when there is no record yet", () => {
    renderSection(null);
    expect(screen.getByText("Fulfilment starts once the order is paid.")).toBeInTheDocument();
  });

  it("offers only the statuses the fulfilment can move to from where it is", () => {
    renderSection(record({ status: "awaiting_dispatch" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const labels = ["In transit", "Ready for collection", "In storage", "Cancelled"];
    expect(offered()).toHaveLength(labels.length);
    labels.forEach((label, index) => {
      expect(offered()[index]).toMatch(new RegExp(`^${label}`));
    });
  });

  it("asks for a status before saving", () => {
    renderSection(record({}));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Choose the next status.")).toBeInTheDocument();
    expect(updateFulfilment).not.toHaveBeenCalled();
  });

  it("goes back to the facts on Cancel without sending anything", () => {
    renderSection(record({}));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    choose("In transit");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(updateFulfilment).not.toHaveBeenCalled();
  });
});

describe("moving into the post", () => {
  function startDispatch() {
    renderSection(record({ status: "awaiting_dispatch" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    choose("In transit");
  }

  it("asks for carrier and tracking only once the status needs them", () => {
    renderSection(record({ status: "awaiting_dispatch" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText(/^Tracking number/)).not.toBeInTheDocument();

    choose("In transit");
    expect(screen.getByLabelText(/^Carrier/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tracking number/)).toBeInTheDocument();
  });

  it("refuses tracking characters the API does not accept, and sends nothing", () => {
    startDispatch();
    fireEvent.change(screen.getByLabelText(/^Carrier/), { target: { value: "DHL" } });
    fireEvent.change(screen.getByLabelText(/^Tracking number/), { target: { value: "AB#1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Use letters, numbers, spaces and hyphens only.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tracking number/)).toHaveAttribute("aria-invalid", "true");
    expect(updateFulfilment).not.toHaveBeenCalled();
  });

  it("clears the error as soon as the field is put right", () => {
    startDispatch();
    fireEvent.change(screen.getByLabelText(/^Tracking number/), { target: { value: "AB#1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Add the carrier this tracking number belongs to."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Carrier/), { target: { value: "DHL" } });
    fireEvent.change(screen.getByLabelText(/^Tracking number/), { target: { value: "AB 1" } });
    expect(
      screen.queryByText("Add the carrier this tracking number belongs to."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/hyphens only/)).not.toBeInTheDocument();
  });

  it("sends the move with carrier and tracking and an idempotency key", async () => {
    startDispatch();
    fireEvent.change(screen.getByLabelText(/^Carrier/), { target: { value: " Royal Mail " } });
    fireEvent.change(screen.getByLabelText(/^Tracking number/), {
      target: { value: "AB 123-456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateFulfilment).toHaveBeenCalledTimes(1));
    expect(updateFulfilment).toHaveBeenCalledWith({
      fulfilmentId: "11111111-1111-4111-8111-111111111111",
      status: "in_transit",
      carrier: "Royal Mail",
      trackingNumber: "AB 123-456",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(recordFulfilmentPossession).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
  });

  it("keeps the form open with the reason when the move is refused", async () => {
    updateFulfilment.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "Invalid fulfilment transition from awaiting_dispatch to in_transit",
    });
    startDispatch();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid fulfilment transition");
    expect(screen.getByLabelText(/^Carrier/)).toBeInTheDocument();
  });
});

describe("recording possession", () => {
  function startDelivery() {
    renderSection(record({ status: "in_transit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    choose("Delivered");
  }

  it("asks when the customer took possession, in London time, only for a possession status", () => {
    renderSection(record({ status: "in_transit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByText("Customer took possession")).not.toBeInTheDocument();

    choose("Delivered");
    expect(screen.getByText("Customer took possession")).toBeInTheDocument();
    expect(screen.getByText(/Europe\/London \((BST|GMT)\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record possession" })).toBeInTheDocument();
  });

  it("will not record possession without a moment, in the future, or before the order was paid", () => {
    startDelivery();
    fireEvent.click(screen.getByRole("button", { name: "Record possession" }));
    expect(
      screen.getByText("Enter the date and time the customer took possession."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Customer took possession"), {
      target: { value: "25 Oct 2026" },
    });
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "10:00" } });
    expect(screen.getByText("Possession cannot be in the future.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Customer took possession"), {
      target: { value: "30 Sep 2026" },
    });
    expect(screen.getByText("Possession cannot be before the order was paid.")).toBeInTheDocument();
    expect(recordFulfilmentPossession).not.toHaveBeenCalled();
  });

  it("sends the status and the moment as an instant, through the possession endpoint", async () => {
    startDelivery();
    fireEvent.change(screen.getByLabelText("Customer took possession"), {
      target: { value: "20 Oct 2026" },
    });
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "14:05" } });
    fireEvent.click(screen.getByRole("button", { name: "Record possession" }));

    await waitFor(() => expect(recordFulfilmentPossession).toHaveBeenCalledTimes(1));
    expect(recordFulfilmentPossession).toHaveBeenCalledWith({
      fulfilmentId: "11111111-1111-4111-8111-111111111111",
      status: "delivered",
      // 14:05 in London on 20 October is British Summer Time, an hour ahead of UTC.
      possessionAt: "2026-10-20T13:05:00.000Z",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(updateFulfilment).not.toHaveBeenCalled();
  });

  it("offers to sign in again when recording possession needs a recent sign-in", async () => {
    recordFulfilmentPossession.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Recent authentication is required for this action",
    });
    startDelivery();
    fireEvent.change(screen.getByLabelText("Customer took possession"), {
      target: { value: "20 Oct 2026" },
    });
    fireEvent.change(screen.getByLabelText("Time, 24-hour clock"), { target: { value: "14:05" } });
    fireEvent.click(screen.getByRole("button", { name: "Record possession" }));

    expect(await screen.findByRole("link", { name: "Sign in again" })).toBeInTheDocument();
  });

  it("treats a later move to the same status as an ordinary update", () => {
    renderSection(record({ status: "in_storage", possessionAt: "2026-10-20T10:00:00.000Z" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    choose("Ready to dispatch");
    expect(screen.queryByText("Customer took possession")).not.toBeInTheDocument();
  });
});
