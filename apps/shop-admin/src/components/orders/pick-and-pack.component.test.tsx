// @vitest-environment jsdom
import type { AdminPickAndPack, AdminPickLine } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirmPrint = vi.fn();
const swapPrint = vi.fn();
const markCertificateSent = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/print-fulfilment-actions.server", () => ({
  confirmPrint,
  swapPrint,
  markCertificateSent,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/orders/o-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { PickAndPackPanel } = await import("./pick-and-pack-panel.client");

const LINE = "11111111-1111-4111-8111-111111111111";

const line = (overrides: Partial<AdminPickLine> = {}): AdminPickLine => ({
  orderLineId: LINE,
  artworkId: "22222222-2222-4222-8222-222222222222",
  artworkTitle: "Harbour at dusk",
  label: "7/24",
  numbered: true,
  storageLocation: "Plan chest B, drawer 3",
  printedToOrder: false,
  confirmedAt: null,
  confirmedBy: null,
  replacedLabel: null,
  certificate: { status: "none", certificateId: null, note: null, issuedAt: null },
  cancelled: false,
  ...overrides,
});

const pack = (...lines: AdminPickLine[]): AdminPickAndPack => ({ orderId: "o", lines });

function openConfirm() {
  fireEvent.click(screen.getByRole("button", { name: /confirm the print for harbour at dusk/i }));
}

describe("PickAndPackPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows nothing for an order with no prints", () => {
    const { container } = render(
      <PickAndPackPanel pack={pack()} canWrite canSwapAcrossOwners={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each print with where it is and how far packing has got", () => {
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    expect(screen.getByRole("heading", { name: "Pick and pack" })).toBeInTheDocument();
    expect(screen.getByText("0 of 1 print confirmed")).toBeInTheDocument();
    expect(screen.getByText("Plan chest B, drawer 3")).toBeInTheDocument();
    expect(screen.getByText(/7\/24/)).toBeInTheDocument();
  });

  it("shows a confirmed print as confirmed, without actions", () => {
    render(
      <PickAndPackPanel
        pack={pack(line({ confirmedAt: "2026-11-04T10:15:00.000Z", confirmedBy: "Pat Jones" }))}
        canWrite
        canSwapAcrossOwners={false}
      />,
    );
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText(/Confirmed by Pat Jones/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm the print/i })).toBeNull();
  });

  it("leaves the actions out for staff who cannot fulfil", () => {
    render(<PickAndPackPanel pack={pack(line())} canWrite={false} canSwapAcrossOwners={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains a blocked certificate and holds back confirming", () => {
    render(
      <PickAndPackPanel
        pack={pack(
          line({
            certificate: {
              status: "blocked",
              certificateId: null,
              note: "Record the artist's written authority",
              issuedAt: null,
            },
          }),
        )}
        canWrite
        canSwapAcrossOwners={false}
      />,
    );
    expect(screen.getAllByText("Record the artist's written authority").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /confirm the print for harbour at dusk/i }),
    ).toBeDisabled();
  });

  it("marks a certificate sent", async () => {
    markCertificateSent.mockResolvedValue({ ok: true, data: { issuedAt: "x" } });
    render(
      <PickAndPackPanel
        pack={pack(
          line({
            confirmedAt: "2026-11-04T10:15:00.000Z",
            certificate: {
              status: "to_send",
              certificateId: "33333333-3333-4333-8333-333333333333",
              note: "Send the certificate separately",
              issuedAt: null,
            },
          }),
        )}
        canWrite
        canSwapAcrossOwners={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /mark the certificate for 7\/24 as sent/i }),
    );
    await waitFor(() =>
      expect(markCertificateSent).toHaveBeenCalledWith(
        expect.objectContaining({ certificateId: "33333333-3333-4333-8333-333333333333" }),
      ),
    );
  });
});

describe("confirming a print", () => {
  beforeEach(() => {
    confirmPrint.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for what is on the print before sending anything", async () => {
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Confirm print" }));
    expect(
      await screen.findByText("Scan the label or type what is written on the print."),
    ).toBeInTheDocument();
    expect(confirmPrint).not.toHaveBeenCalled();
  });

  it("sends the typed label and refreshes on a match", async () => {
    confirmPrint.mockResolvedValue({
      ok: true,
      data: {
        outcome: "confirmed",
        label: "7/24",
        certificate: { status: "none", certificateId: null, note: null, issuedAt: null },
      },
    });
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    openConfirm();
    fireEvent.change(screen.getByRole("textbox", { name: /what is on the print/i }), {
      target: { value: "7/24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm print" }));
    await waitFor(() =>
      expect(confirmPrint).toHaveBeenCalledWith(
        expect.objectContaining({
          orderLineId: LINE,
          body: { source: "typed_label", value: "7/24" },
        }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says what the print in hand is and offers to send it when the owner is the same", async () => {
    confirmPrint.mockResolvedValue({
      ok: true,
      data: {
        outcome: "swap_available",
        needsAdmin: false,
        to: { editionId: "44444444-4444-4444-8444-444444444444", label: "9/24" },
        reason: "9/24 has the same owner as 7/24, so the payout does not change",
      },
    });
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    openConfirm();
    fireEvent.change(screen.getByRole("textbox", { name: /what is on the print/i }), {
      target: { value: "9/24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm print" }));
    expect(await screen.findByText("This is 9/24. The order is for 7/24")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull 7/24 instead" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send 9/24 instead" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disables sending a print another party owns for staff who are not shop admins, and says why", async () => {
    confirmPrint.mockResolvedValue({
      ok: true,
      data: {
        outcome: "swap_available",
        needsAdmin: true,
        to: { editionId: "44444444-4444-4444-8444-444444444444", label: "21/24" },
        reason: "different owner",
      },
    });
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    openConfirm();
    fireEvent.change(screen.getByRole("textbox", { name: /what is on the print/i }), {
      target: { value: "21/24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm print" }));
    expect(await screen.findByRole("button", { name: "Send 21/24 instead" })).toBeDisabled();
    expect(
      screen.getByText("Only a shop admin can send a print another party owns."),
    ).toBeInTheDocument();
  });

  it("shows a refusal from the server in the dialog", async () => {
    confirmPrint.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message:
        "Record the artist's written authority before London Art Exchange issues certificates",
    });
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    openConfirm();
    fireEvent.change(screen.getByRole("textbox", { name: /what is on the print/i }), {
      target: { value: "7/24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm print" }));
    expect(
      await screen.findByText(/written authority before London Art Exchange/),
    ).toBeInTheDocument();
  });
});

describe("replacing a print", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("needs a reason, then sends the next free print", async () => {
    swapPrint.mockResolvedValue({
      ok: true,
      data: { label: "8/24", previousLabel: "7/24", payoutMoved: false, buyerNotified: true },
    });
    render(<PickAndPackPanel pack={pack(line())} canWrite canSwapAcrossOwners={false} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions for 7/24" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /send another print/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Send the next free print" }));
    expect(await screen.findByText("Say why this print is being replaced.")).toBeInTheDocument();
    expect(swapPrint).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: /why is it being replaced/i }), {
      target: { value: "Corner creased" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send the next free print" }));
    await waitFor(() =>
      expect(swapPrint).toHaveBeenCalledWith(
        expect.objectContaining({ orderLineId: LINE, body: { reason: "Corner creased" } }),
      ),
    );
  });
});
