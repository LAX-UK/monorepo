import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SaleActionTarget, useSaleActions } from "./use-sale-actions";

const refresh = vi.fn();
const cancelAction = vi.fn();
const deleteAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminCancelSaleResultAction: (...args: unknown[]) => cancelAction(...args),
  adminMarkSaleEndedResultAction: vi.fn(),
  adminPublishSaleResultAction: vi.fn(),
  adminUnpublishSaleResultAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin-sales", () => ({
  adminSoftDeleteSaleResultAction: (...args: unknown[]) => deleteAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const sale: SaleActionTarget = {
  id: "sale_1",
  title: "Autumn Contemporary",
  status: "active",
  saleroom: false,
  canDelete: false,
  sellingOnAtg: false,
};

function Harness({
  target,
  canManageSales = true,
}: { target: SaleActionTarget; canManageSales?: boolean }) {
  const actions = useSaleActions({ canManageSales });
  return (
    <>
      {actions.actionsFor(target).map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={Boolean(action.disabledReason)}
          onClick={() => action.onSelect?.()}
        >
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useSaleActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, cancelAction, deleteAction, notifySuccess]) fn.mockReset();
  });

  it("offers nothing to a role that cannot manage sales", () => {
    render(<Harness target={sale} canManageSales={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("cancels a live sale only with a reason, and keeps the sale as the way out", async () => {
    cancelAction.mockResolvedValue({ ok: true });
    render(<Harness target={sale} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel sale…" }));
    expect(screen.getByRole("button", { name: "Keep sale" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
      target: { value: "Venue flooded" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel sale" }));
    await waitFor(() => expect(cancelAction).toHaveBeenCalledWith("sale_1", "Venue flooded"));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Autumn Contemporary cancelled"),
    );
  });

  it("leaves a sale selling on ATG to ATG", () => {
    render(<Harness target={{ ...sale, status: "draft", sellingOnAtg: true, canDelete: true }} />);
    expect(screen.getByRole("button", { name: "Publish sale" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel sale…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete sale…" })).toBeDisabled();
  });

  it("offers ending only for saleroom sales", () => {
    const { rerender } = render(<Harness target={sale} />);
    expect(screen.queryByRole("button", { name: "End onsite sale…" })).not.toBeInTheDocument();
    rerender(<Harness target={{ ...sale, saleroom: true }} />);
    expect(screen.getByRole("button", { name: "End onsite sale…" })).toBeInTheDocument();
  });
});
