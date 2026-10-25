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

    expect(screen.getByText("Enter a lot title")).toBeInTheDocument();
    expect(screen.getByText("Add a catalogue description")).toBeInTheDocument();
    expect(screen.getByText("Add at least one image")).toBeInTheDocument();
    expect(screen.getByText("Choose a seller")).toBeInTheDocument();
    expect(screen.getByText("Pick at least one category")).toBeInTheDocument();
    expect(addAction).not.toHaveBeenCalled();
  });

  it("clears a field's message as soon as it is fixed", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Add lot to sale"));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Blue Interior" } });

    expect(screen.queryByText("Enter a lot title")).toBeNull();
    expect(screen.getByText("Add a catalogue description")).toBeInTheDocument();
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
