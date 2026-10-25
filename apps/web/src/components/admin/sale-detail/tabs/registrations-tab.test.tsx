import { SaleRegistrationsTab } from "@/components/admin/sale-detail/tabs/registrations-tab";
import { useSaleRegistrationActions } from "@/components/admin/sale-detail/tabs/use-sale-registration-actions";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminDecideSaleRegistrationResultAction: vi.fn(),
  adminSaleroomCheckInResultAction: vi.fn(),
  adminAssignPaddleResultAction: vi.fn(),
  adminClearPaddleResultAction: vi.fn(),
  adminSaleroomCheckInCandidatesResultAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: { items: [] } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
}));

function registration(overrides: Partial<AdminSaleRegistrationRow> = {}): AdminSaleRegistrationRow {
  return {
    id: "reg-1",
    saleId: "sale-1",
    userId: "user-1",
    buyerLegalEntityId: "le-1",
    status: "pending",
    requestedAt: "2026-06-01T10:00:00.000Z",
    decidedAt: null,
    decidedByUserId: null,
    bidLimit: null,
    paddleNumber: null,
    checkedInAt: null,
    kycStatus: "approved",
    laxNotes: null,
    rejectionReason: null,
    userEmail: "ada@example.com",
    userName: "Ada Lovelace",
    buyerLegalEntityDisplayName: "Ada Lovelace",
    memberRole: null,
    ...overrides,
  };
}

const sale = (deliveryMode: Sale["deliveryMode"] = "online") => ({ deliveryMode }) as Sale;

const baseProps = {
  saleId: "sale-1",
  liveish: true,
  fetchError: null,
  actionError: null,
};

function Menu({
  row,
  saleroom = false,
  hybrid = false,
}: { row: AdminSaleRegistrationRow; saleroom?: boolean; hybrid?: boolean }) {
  const { actionsFor } = useSaleRegistrationActions({ saleId: "sale-1", saleroom, hybrid });
  return (
    <ul>
      {actionsFor(row).map((action) => (
        <li key={action.id} data-reason={action.disabledReason ?? ""}>
          {action.label}
        </li>
      ))}
    </ul>
  );
}

const labels = () => screen.getAllByRole("listitem").map((item) => item.textContent);

describe("SaleRegistrationsTab", () => {
  it("lists each bidder with their status", () => {
    render(<SaleRegistrationsTab {...baseProps} sale={sale()} rows={[registration()]} />);

    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  });

  it("says what will appear when there are no registrations", () => {
    render(<SaleRegistrationsTab {...baseProps} sale={sale()} rows={[]} />);

    expect(screen.getByText("No registrations yet")).toBeInTheDocument();
  });

  it("shows a refused action as a notice at the top", () => {
    render(
      <SaleRegistrationsTab
        {...baseProps}
        sale={sale()}
        rows={[registration()]}
        actionError="Registration already decided"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Registration already decided");
  });

  it("shows a failed load as an error instead of an empty table", () => {
    render(<SaleRegistrationsTab {...baseProps} sale={sale()} rows={[]} fetchError="Timed out" />);

    expect(screen.getByText("Registrations could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Timed out")).toBeInTheDocument();
    expect(screen.queryByText("No registrations yet")).not.toBeInTheDocument();
  });

  it("waits for the sale to be scheduled before taking registrations", () => {
    render(<SaleRegistrationsTab {...baseProps} liveish={false} sale={sale()} rows={[]} />);

    expect(screen.getByText("Registrations open with the sale")).toBeInTheDocument();
  });

  it("adds in-room check-in to a saleroom sale", () => {
    render(<SaleRegistrationsTab {...baseProps} sale={sale("onsite")} rows={[]} />);

    expect(screen.getByText("In-room check-in")).toBeInTheDocument();
  });
});

describe("useSaleRegistrationActions", () => {
  it("approves or rejects a pending request, with reject last", () => {
    render(<Menu row={registration()} />);

    expect(labels()).toEqual(["Approve", "Open client", "Reject"]);
  });

  it("offers nothing to decide on an approved online registration", () => {
    render(<Menu row={registration({ status: "approved" })} />);

    expect(labels()).toEqual(["Open client"]);
  });

  it("offers a paddle to an approved saleroom bidder who has none", () => {
    render(<Menu row={registration({ status: "approved" })} saleroom />);

    expect(labels()).toEqual(["Assign paddle", "Open client"]);
  });

  it("holds the paddle back until the identity check is complete", () => {
    render(<Menu row={registration({ status: "approved", kycStatus: "pending" })} saleroom />);

    expect(screen.getByText("Assign paddle")).toHaveAttribute(
      "data-reason",
      "Opens once the identity check is complete",
    );
  });

  it("lets a hybrid sale mark an approved bidder present", () => {
    render(<Menu row={registration({ status: "approved" })} saleroom hybrid />);

    expect(labels()).toEqual(["Mark present", "Assign paddle", "Open client"]);
  });
});
