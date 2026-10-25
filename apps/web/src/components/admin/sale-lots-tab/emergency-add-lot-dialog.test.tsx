import { EmergencyAddLotDialog } from "@/components/admin/sale-lots-tab/emergency-add-lot-dialog";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminAddLotToSaleResultAction: (...args: unknown[]) => addAction(...args),
}));
vi.mock("@/lib/actions/admin-legal-entities-browse", () => ({
  searchAdminLegalEntitiesBrowseAction: vi.fn(),
}));
vi.mock("@/components/admin/media/staff-image-collection", () => ({
  StaffImageCollection: () => null,
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

function renderDialog(deliveryMode: "online" | "onsite" = "online") {
  return render(
    <EmergencyAddLotDialog
      open
      onOpenChange={vi.fn()}
      saleId="sale-1"
      saleStatus="active"
      deliveryMode={deliveryMode}
      saleStartTime={new Date("2026-11-01T10:00:00Z")}
      saleEndTime={new Date("2026-11-08T10:00:00Z")}
      categories={[]}
      englishOnlyAuctionsLocked={false}
      onAdded={vi.fn()}
    />,
  );
}

describe("EmergencyAddLotDialog", () => {
  beforeEach(() => addAction.mockReset());
  afterEach(cleanup);

  it("names the missing details on submit and does not save", () => {
    renderDialog();

    fireEvent.click(screen.getByText("Add lot to sale"));

    // The summary at the top takes focus and links each problem to its field.
    const summary = screen.getByRole("alert", { name: "There is a problem" });
    expect(summary).toHaveFocus();
    for (const message of [
      "Enter a lot title",
      "Add a catalogue description",
      "Add at least one image",
      "Choose a seller",
      "Pick at least one category",
    ]) {
      expect(screen.getAllByText(message)).toHaveLength(2);
    }
    expect(screen.getByRole("link", { name: "Enter a lot title" })).toHaveAttribute(
      "href",
      "#emergency-add-lot-title",
    );
    expect(addAction).not.toHaveBeenCalled();
  });

  it("clears a field's message as soon as it is fixed", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Add lot to sale"));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Blue Interior" } });

    expect(screen.queryByText("Enter a lot title")).toBeNull();
    expect(screen.getAllByText("Add a catalogue description")).toHaveLength(2);
    // Fixing a field never pulls focus back to the summary.
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("asks for the lot's own times on an online sale only", () => {
    renderDialog("online");
    expect(screen.getByText("Lot opens")).toBeInTheDocument();
    expect(screen.getByText("Lot closes")).toBeInTheDocument();
    cleanup();

    renderDialog("onsite");
    expect(screen.queryByText("Lot opens")).toBeNull();
  });
});
