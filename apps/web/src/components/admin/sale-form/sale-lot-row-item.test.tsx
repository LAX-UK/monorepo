import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import {
  adminAddLotToSaleResultAction,
  adminDetachLotFromSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  type SaleSetupLotRowContext,
  type SaleSetupLotRowFormValues,
  emptySaleSetupLotRow,
} from "@/lib/admin/sale-setup";
import { actionSuccess } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleLotRowItem } from "./sale-lot-row-item";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/actions/admin", () => ({
  adminUpdateLotResultAction: vi.fn(),
}));

vi.mock("@/lib/actions/admin-sales", () => ({
  adminAddLotToSaleResultAction: vi.fn(),
  adminDetachLotFromSaleResultAction: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/admin/attach-existing-lot-review", () => ({
  AttachExistingLotReview: ({ headerSlot }: { headerSlot?: React.ReactNode }) => (
    <div data-testid="attach-existing-lot-review">{headerSlot}</div>
  ),
}));

const SALE_ID = "10000000-0000-4000-8000-000000000001";
const LOT_ID = "40000000-0000-4000-8000-000000000004";
const SELLER_ID = "20000000-0000-4000-8000-000000000002";
const CATEGORY_ID = "30000000-0000-4000-8000-000000000003";

const ctx: SaleSetupLotRowContext = {
  saleStartTime: new Date("2030-01-01T10:00:00"),
  saleEndTime: new Date("2030-01-07T18:00:00"),
  deliveryMode: "online",
  englishOnlyAuctionsLocked: false,
};

function validDraftRow(
  overrides: Partial<SaleSetupLotRowFormValues> = {},
): SaleSetupLotRowFormValues {
  return {
    ...emptySaleSetupLotRow("client-row-1"),
    title: "Blue vase",
    sellerLegalEntityId: SELLER_ID,
    categoryIds: [CATEGORY_ID],
    startingPrice: "100.00",
    startTime: "2030-01-02T10:00",
    endTime: "2030-01-03T18:00",
    ...overrides,
  };
}

function baseProps(
  row: SaleSetupLotRowFormValues,
  overrides: Partial<ComponentProps<typeof SaleLotRowItem>> = {},
) {
  return {
    row,
    rowIndex: 0,
    ctx,
    categories: [],
    artists: [],
    englishOnlyAuctionsLocked: false,
    readOnly: false,
    saleId: SALE_ID,
    onSaved: vi.fn(),
    onRemove: vi.fn(),
    onDetached: vi.fn(),
    onScheduleUpdated: vi.fn(),
    ...overrides,
  };
}

describe("SaleLotRowItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders attached-saved mode with detach control", () => {
    const row = validDraftRow({
      source: "existing",
      lotId: LOT_ID,
      title: "Attached inventory lot",
    });
    render(<SaleLotRowItem {...baseProps(row)} />);

    expect(screen.getByText("Attached")).toBeInTheDocument();
    expect(screen.getByText("Attached inventory lot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detach lot from sale" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save lot" })).not.toBeInTheDocument();
  });

  it("renders attach-existing review mode for unsaved existing rows", () => {
    const row = validDraftRow({ source: "existing", title: "" });
    render(<SaleLotRowItem {...baseProps(row)} />);

    expect(screen.getByTestId("attach-existing-lot-review")).toBeInTheDocument();
    expect(screen.getByText("Attach existing lot 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove row" })).toBeInTheDocument();
  });

  it("renders editable form with save and reset for unsaved new lots", () => {
    const row = validDraftRow();
    render(<SaleLotRowItem {...baseProps(row)} />);

    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save lot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset row" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update lot schedule" })).not.toBeInTheDocument();
  });

  it("renders update-schedule action for saved non-inherited lots", () => {
    const row = validDraftRow({ lotId: LOT_ID });
    render(<SaleLotRowItem {...baseProps(row)} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update lot schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save lot" })).not.toBeInTheDocument();
  });

  it("save happy path calls onSaved and notifies success", async () => {
    const savedLotId = "50000000-0000-4000-8000-000000000005";
    vi.mocked(adminAddLotToSaleResultAction).mockResolvedValue(actionSuccess({ id: savedLotId }));
    const onSaved = vi.fn();
    const row = validDraftRow();

    render(<SaleLotRowItem {...baseProps(row, { onSaved })} />);
    fireEvent.click(screen.getByRole("button", { name: "Save lot" }));

    await waitFor(() => {
      expect(adminAddLotToSaleResultAction).toHaveBeenCalledWith(SALE_ID, expect.any(Object));
      expect(onSaved).toHaveBeenCalledWith(
        savedLotId,
        expect.objectContaining({ title: "Blue vase" }),
      );
      expect(notify.success).toHaveBeenCalledWith('"Blue vase" saved to this sale.');
    });
  });

  it("save validation failure surfaces field errors and notifies", async () => {
    const row = validDraftRow({ title: "" });
    render(<SaleLotRowItem {...baseProps(row)} />);

    fireEvent.click(screen.getByRole("button", { name: "Save lot" }));

    await waitFor(() => {
      expect(adminAddLotToSaleResultAction).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalled();
      expect(screen.getByText("Enter a lot title")).toBeInTheDocument();
    });
  });

  it("detach confirms then calls onRemove and onDetached", async () => {
    vi.mocked(adminDetachLotFromSaleResultAction).mockResolvedValue(actionSuccess());
    const onRemove = vi.fn();
    const onDetached = vi.fn();
    const row = validDraftRow({
      source: "existing",
      lotId: LOT_ID,
      title: "Detach me",
    });

    render(<SaleLotRowItem {...baseProps(row, { onRemove, onDetached })} />);
    fireEvent.click(screen.getByRole("button", { name: "Detach lot from sale" }));
    fireEvent.click(screen.getByRole("button", { name: "Detach" }));

    await waitFor(() => {
      expect(adminDetachLotFromSaleResultAction).toHaveBeenCalledWith(SALE_ID, LOT_ID);
      expect(onRemove).toHaveBeenCalled();
      expect(onDetached).toHaveBeenCalled();
      expect(notify.success).toHaveBeenCalledWith("Detached Detach me");
    });
  });

  it("shows schedule out of sync badge when saved lot falls outside sale window", () => {
    const row = validDraftRow({
      lotId: LOT_ID,
      startTime: "2029-12-31T10:00",
      endTime: "2030-01-02T10:00",
    });
    render(<SaleLotRowItem {...baseProps(row)} />);

    expect(screen.getByText("Schedule out of sync")).toBeInTheDocument();
  });

  it("update schedule happy path calls server action with only start and end times", async () => {
    vi.mocked(adminUpdateLotResultAction).mockResolvedValue(actionSuccess());
    const onScheduleUpdated = vi.fn();
    const row = validDraftRow({ lotId: LOT_ID });

    render(<SaleLotRowItem {...baseProps(row, { onScheduleUpdated })} />);
    fireEvent.click(screen.getByRole("button", { name: "Update lot schedule" }));

    await waitFor(() => {
      expect(adminUpdateLotResultAction).toHaveBeenCalledWith(
        LOT_ID,
        expect.objectContaining({
          startTime: expect.any(Date),
          endTime: expect.any(Date),
        }),
      );
      const [, payload] = vi.mocked(adminUpdateLotResultAction).mock.calls[0] ?? [];
      expect(Object.keys(payload ?? {})).toEqual(["startTime", "endTime"]);
      expect(onScheduleUpdated).toHaveBeenCalled();
      expect(notify.success).toHaveBeenCalledWith("Lot schedule updated");
    });
  });

  it("hides detach control in read-only attached mode", () => {
    const row = validDraftRow({
      source: "existing",
      lotId: LOT_ID,
      title: "Read-only attached",
    });
    render(<SaleLotRowItem {...baseProps(row, { readOnly: true })} />);

    expect(screen.queryByRole("button", { name: "Detach lot from sale" })).not.toBeInTheDocument();
  });
});
