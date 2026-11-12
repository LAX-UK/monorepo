import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealView } from "./deal-view";
import { dealRecord, unconfiguredDeal } from "./deal.fixture";

const refresh = vi.fn();
const move = vi.fn();
const updateTerms = vi.fn();
const nameBuyer = vi.fn();
const notifySuccess = vi.fn();
const handleStepUp = vi.fn((_failure: unknown) => false);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/private-sales/PS-0012",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-private-sales", () => ({
  dealMoveAction: (...args: unknown[]) => move(...args),
  updateDealTermsAction: (...args: unknown[]) => updateTerms(...args),
  nameDealBuyerAction: (...args: unknown[]) => nameBuyer(...args),
  convertEnquiryAction: vi.fn(),
  setDealArtworkAction: vi.fn(),
  removeDealArtworkAction: vi.fn(),
  searchDealArtworksAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  handleStaffStepUp: (failure: unknown) => handleStepUp(failure),
}));
vi.mock("@/components/admin/staff/platform-user-picker", () => ({
  PlatformUserPicker: ({
    onValueChange,
  }: { onValueChange: (o: { id: string } | null) => void }) => (
    <button type="button" onClick={() => onValueChange({ id: "u-new-buyer" })}>
      Pick a buyer
    </button>
  ),
}));

function renderView(deal = dealRecord()) {
  return render(
    <StaffTooltipProvider>
      <DealView deal={deal} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  handleStepUp.mockReturnValue(false);
  move.mockResolvedValue({ ok: true, data: dealRecord({ stage: "agreed" }) });
  updateTerms.mockResolvedValue({ ok: true, data: dealRecord() });
  nameBuyer.mockResolvedValue({ ok: true, data: dealRecord() });
});

describe("DealView: an offer waiting on the buyer's acceptance", () => {
  it("shows the work, the stage, who is on each side and the money", () => {
    renderView();
    expect(
      screen.getByRole("heading", { level: 1, name: "PS-0012 · Harbour at dusk" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Offer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Henry Lowe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marlow Collection Ltd").length).toBeGreaterThan(0);
    const money = screen.getByRole("region", { name: "Money" });
    expect(within(money).getAllByText("£48,000.00").length).toBeGreaterThan(1);
    expect(within(money).getByText("£40,550.00")).toBeInTheDocument();
  });

  it("makes the next move the primary action, switched off, and says why in words", () => {
    renderView();
    const button = screen.getByRole("button", { name: "Record the agreement" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/The buyer has not accepted the private sale terms/);
    expect(screen.getByText("Before you can record the agreement")).toBeInTheDocument();
  });

  it("states the VAT treatment as waiting for finance, not as a value", () => {
    renderView();
    expect(screen.getByText("To be set by finance")).toBeInTheDocument();
  });

  it("shows the checks as the existing records report them, and where they are decided", () => {
    renderView();
    const parties = screen.getByRole("region", { name: "Parties and checks" });
    expect(within(parties).getAllByText("Verified")).toHaveLength(2);
    expect(within(parties).getAllByText("Clear")).toHaveLength(2);
    expect(within(parties).getByText("Waiting for review")).toBeInTheDocument();
    expect(within(parties).getByRole("link", { name: "AML screening" })).toHaveAttribute(
      "href",
      "/admin/compliance/aml",
    );
  });

  it("links back to the enquiry it came from", () => {
    renderView();
    expect(screen.getByRole("link", { name: "E-1042" })).toHaveAttribute(
      "href",
      "/admin/enquiries/E-1042",
    );
  });
});

describe("DealView: terms not configured", () => {
  it("says so at the top, and on each line that waits for it, never with a guessed value", () => {
    renderView(unconfiguredDeal());
    expect(screen.getAllByText("Terms not configured").length).toBeGreaterThanOrEqual(5);
    expect(
      screen.getByText(
        /the private sale terms, the commission rate, the VAT treatments and the payment deadline/,
      ),
    ).toBeInTheDocument();
    const terms = screen.getByRole("region", { name: "Terms" });
    expect(within(terms).getAllByText("Terms not configured").length).toBeGreaterThanOrEqual(2);
    const money = screen.getByRole("region", { name: "Money" });
    expect(within(money).getAllByText("Terms not configured").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/NaN|undefined|null/)).toBeNull();
  });

  it("keeps the agreement off and names the missing terms as the reason", () => {
    renderView(unconfiguredDeal());
    expect(screen.getByRole("button", { name: "Record the agreement" })).toBeDisabled();
    expect(
      screen.getByText("The private sale terms have not been set up yet."),
    ).toBeInTheDocument();
  });
});

describe("DealView: making a move", () => {
  const clearToAgree = () =>
    dealRecord({
      actions: [
        { action: "agree", blockers: [] },
        { action: "cancel", blockers: [] },
      ],
    });

  it("opens a confirmation that states the effect first, then records the move", async () => {
    renderView(clearToAgree());
    fireEvent.click(screen.getByRole("button", { name: "Record the agreement" }));
    const dialog = await screen.findByRole("dialog", { name: /Record the agreement · PS-0012/ });
    expect(within(dialog).getByText(/The price is then fixed/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Record agreement" }));
    await waitFor(() => expect(move).toHaveBeenCalledTimes(1));
    expect(move).toHaveBeenCalledWith(
      "PS-0012",
      "agree",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Agreement recorded · PS-0012"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows why a move was refused, in the dialog, and leaves it open", async () => {
    move.mockResolvedValue({
      ok: false,
      error: "This can't be done yet.",
      errorCode: "blocked",
      meta: {
        blockers: [
          { code: "kyc_not_clear", message: "The buyer has not verified their identity yet." },
        ],
      },
    });
    renderView(clearToAgree());
    fireEvent.click(screen.getByRole("button", { name: "Record the agreement" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record agreement" }));
    expect(
      await within(dialog).findByText("The buyer has not verified their identity yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers a reload when the deal changed under the person", async () => {
    move.mockResolvedValue({ ok: false, error: "changed", errorCode: "stale_version" });
    renderView(clearToAgree());
    fireEvent.click(screen.getByRole("button", { name: "Record the agreement" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record agreement" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("hands a stale sign-in to the step-up flow instead of showing an error", async () => {
    handleStepUp.mockReturnValue(true);
    move.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    renderView(
      dealRecord({
        stage: "cleared",
        actions: [{ action: "issue_invoice", blockers: [] }],
        editableTerms: [],
        canNameBuyer: false,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Issue the invoice" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/you may be asked to sign in again first/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue invoice" }));
    await waitFor(() => expect(handleStepUp).toHaveBeenCalled());
    expect(within(dialog).queryByText(/didn't go through/)).toBeNull();
  });

  it("will not cancel without a reason, and says so next to the field", async () => {
    renderView();
    fireEvent.keyDown(screen.getByRole("button", { name: "More private sale actions" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancel the deal" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel deal" }));
    expect(await within(dialog).findByText("Give a reason for cancelling.")).toBeInTheDocument();
    expect(move).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason/ }), {
      target: { value: "Seller withdrew" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel deal" }));
    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(
        "PS-0012",
        "cancel",
        expect.objectContaining({ reason: "Seller withdrew" }),
      ),
    );
  });
});

describe("DealView: terms and buyer", () => {
  it("edits only the terms that are open and sends only what changed", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Edit terms" }));
    const dialog = await screen.findByRole("dialog", { name: /Terms · PS-0012/ });
    expect(within(dialog).queryByLabelText(/VAT treatment/)).toBeNull();
    expect(within(dialog).queryByLabelText(/Seller's commission/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Agreed price/), { target: { value: "50000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save terms" }));
    await waitFor(() => expect(updateTerms).toHaveBeenCalledTimes(1));
    expect(updateTerms).toHaveBeenCalledWith("PS-0012", {
      version: 4,
      terms: { priceMinor: 5_000_000 },
    });
  });

  it("names the buyer from the search results", async () => {
    renderView(dealRecord({ buyer: null }));
    fireEvent.click(screen.getByRole("button", { name: "Name the buyer" }));
    const dialog = await screen.findByRole("dialog", { name: /Name the buyer/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Name buyer" }));
    expect(
      await within(dialog).findByText("Choose the buyer from the search results."),
    ).toBeInTheDocument();
    expect(nameBuyer).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Pick a buyer" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Name buyer" }));
    await waitFor(() =>
      expect(nameBuyer).toHaveBeenCalledWith("PS-0012", { version: 4, buyerUserId: "u-new-buyer" }),
    );
  });
});

describe("DealView: people who work without the checks", () => {
  it("shows the parties and their terms, and no identity, screening or source-of-funds rows", () => {
    renderView(
      dealRecord({
        sourceOfFunds: null,
        seller: { ...dealRecord().seller, kyc: null, aml: null },
        buyer: {
          ...(dealRecord().buyer as NonNullable<ReturnType<typeof dealRecord>["buyer"]>),
          kyc: null,
          aml: null,
        },
      }),
    );
    const parties = screen.getByRole("region", { name: "Parties" });
    expect(within(parties).getAllByText("Terms")).toHaveLength(2);
    for (const label of ["Identity", "Screening", "Source of funds"]) {
      expect(within(parties).queryByText(label)).toBeNull();
    }
    expect(within(parties).queryByRole("link", { name: "AML screening" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Parties and checks" })).toBeNull();
  });
});

describe("DealView: people who cannot act", () => {
  it("is view only, with no buttons that would be refused", () => {
    renderView(
      dealRecord({
        actions: [],
        editableTerms: [],
        canNameBuyer: false,
        artworkAccess: { canLink: false, canChange: false, changeOffReason: null },
      }),
    );
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record the agreement" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit terms" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Name the buyer" })).toBeNull();
    expect(screen.queryByRole("button", { name: /artwork…/ })).toBeNull();
  });

  it("says a cancelled deal is cancelled, with its reason, and offers nothing", () => {
    renderView(
      dealRecord({
        stage: "cancelled",
        cancelReason: "Seller withdrew",
        cancelledAt: "2026-11-05T10:00:00.000Z",
        actions: [],
        editableTerms: [],
        canNameBuyer: false,
      }),
    );
    expect(screen.getByText(/Reason: Seller withdrew/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record the agreement/ })).toBeNull();
  });
});
