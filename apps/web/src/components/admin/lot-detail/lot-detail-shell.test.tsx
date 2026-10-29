import { BidStaffAccessProvider } from "@/components/admin/access/bid-staff-access-provider";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render as baseRender, fireEvent, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LotDetailShell } from "./lot-detail-shell";

const publishAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/lots/lot_1",
}));
vi.mock("@/lib/actions/admin", () => ({
  adminPublishLotResultAction: (...args: unknown[]) => publishAction(...args),
  adminCancelLotResultAction: vi.fn(),
  adminSoftDeleteLotResultAction: vi.fn(),
  adminApproveWithdrawalRequestResultAction: vi.fn(),
  adminDeclineWithdrawalRequestResultAction: vi.fn(),
  adminReturnLotToInventoryResultAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/field-updates", () => ({
  adminUpdateLotTitleFieldAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), action: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

const ready: CatalogReadinessResult = { items: [], completeCount: 4, totalCount: 4, percent: 100 };
const blocked: CatalogReadinessResult = {
  items: [{ id: "images", label: "Add at least one photo", ok: false, severity: "required" }],
  completeCount: 3,
  totalCount: 4,
  percent: 75,
};

function bundle(saleStatus: "draft" | "scheduled" = "scheduled"): AdminLotDetailBundle {
  return {
    auction: {
      id: "lot_1",
      title: "Harbour at Dusk",
      status: "draft",
      auctionType: "english",
      lotNumber: 12,
      images: [],
      description: "Oil on board",
      winnerId: null,
      sellerLegalEntityId: "le_1",
      marketingDetails: {},
    },
    context: {
      sale: {
        id: "sale_1",
        title: "Autumn Contemporary",
        status: saleStatus,
        deliveryMode: "online",
        startTime: new Date(),
        endTime: new Date(),
      },
      parentSaleLotCount: 3,
      artist: null,
      seller: null,
      categories: [],
    },
    deleteEligibility: { canDelete: true, blockers: [] },
  } as unknown as AdminLotDetailBundle;
}

const render = (ui: ReactElement) => baseRender(<StaffTooltipProvider>{ui}</StaffTooltipProvider>);

describe("LotDetailShell", () => {
  beforeEach(() => publishAction.mockReset());

  it("makes Publish the primary action on a draft that can be published", () => {
    render(
      <LotDetailShell
        lotId="lot_1"
        bundle={bundle()}
        canManageCatalog
        canManageAuction
        publishReadiness={ready}
      >
        <p>Overview</p>
      </LotDetailShell>,
    );
    const publish = screen.getByRole("button", { name: /^publish$/i });
    expect(publish).not.toHaveAttribute("aria-disabled");
    fireEvent.click(publish);
    expect(screen.getByRole("button", { name: "Publish lot" })).toBeInTheDocument();
  });

  it("shows Publish disabled with the readiness reason while checks are open", () => {
    render(
      <LotDetailShell
        lotId="lot_1"
        bundle={bundle()}
        canManageCatalog
        canManageAuction
        publishReadiness={blocked}
      >
        <p>Overview</p>
      </LotDetailShell>,
    );
    expect(screen.getByRole("button", { name: /^publish$/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("offers no Publish to staff who cannot catalogue", () => {
    render(
      <LotDetailShell lotId="lot_1" bundle={bundle()} canManageAuction publishReadiness={ready}>
        <p>Overview</p>
      </LotDetailShell>,
    );
    expect(screen.queryByRole("button", { name: /^publish$/i })).toBeNull();
  });

  it("shows read-only staff the lot view only, with their role and no actions", () => {
    render(
      <BidStaffAccessProvider platformRole="staff" staffRoles={["read_only"]}>
        <LotDetailShell lotId="lot_1" bundle={bundle()} publishReadiness={ready}>
          <p>Overview</p>
        </LotDetailShell>
      </BidStaffAccessProvider>,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^publish$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
  });
});
