import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { type AtgRemoteStatus, type SaleStatus, toAtgSaleSellingSummary } from "@auction/types";
import { render as baseRender, fireEvent, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SaleDetailShell } from "./sale-detail-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/sales/sale_1",
}));
vi.mock("@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations", () => ({
  adminCancelSaleResultAction: vi.fn(),
  adminMarkSaleEndedResultAction: vi.fn(),
  adminPublishSaleResultAction: vi.fn(),
  adminUnpublishSaleResultAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin-sales", () => ({ adminSoftDeleteSaleResultAction: vi.fn() }));
vi.mock("@/lib/actions/admin/field-updates", () => ({
  adminUpdateSaleTitleFieldAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), action: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));
vi.mock("@/components/admin/qr-code/admin-qr-code-button", () => ({
  AdminQrCodeButton: () => null,
}));

const ready: CatalogReadinessResult = { items: [], completeCount: 4, totalCount: 4, percent: 100 };

function bundle(status: SaleStatus): AdminSaleListRow {
  return {
    sale: {
      id: "sale_1",
      title: "Autumn Contemporary",
      status,
      deliveryMode: "online",
      startTime: new Date("2026-11-12T18:00:00.000Z"),
      endTime: new Date("2026-11-12T21:00:00.000Z"),
    },
    lots: [],
    deleteEligibility: { canDelete: true, confirmationPhrase: null, guards: {}, blockers: [] },
  } as unknown as AdminSaleListRow;
}

function selling(
  saleStatus: SaleStatus,
  link: {
    remoteStatus?: AtgRemoteStatus | null;
    soldLotCount?: number;
    approvedAt?: string | null;
  } = {},
) {
  return toAtgSaleSellingSummary({
    saleStatus,
    atgRemoteStatus: link.remoteStatus ?? null,
    atgLinked: link.remoteStatus != null,
    atgSoldLotCount: link.soldLotCount ?? 0,
    atgApprovedAt: link.approvedAt ?? null,
  });
}

const render = (ui: ReactElement) => baseRender(<StaffTooltipProvider>{ui}</StaffTooltipProvider>);

function renderShell(status: SaleStatus, summary: ReturnType<typeof selling> | null) {
  return render(
    <SaleDetailShell
      saleId="sale_1"
      bundle={bundle(status)}
      canManageSales
      draftSetupReadiness={ready}
      selling={summary}
    >
      <p>Overview</p>
    </SaleDetailShell>,
  );
}

const badge = () => document.querySelector("[data-selling-platform]");

describe("SaleDetailShell selling badge", () => {
  it.each([
    ["draft", {}, null],
    ["scheduled", {}, "lax.bid"],
    ["active", {}, "lax.bid"],
    ["ended", {}, "lax.bid"],
    ["draft", { remoteStatus: "created" }, "ATG · Draft"],
    [
      "draft",
      { remoteStatus: "created", approvedAt: "2026-10-20T10:00:00.000Z" },
      "ATG · Approved",
    ],
    ["draft", { remoteStatus: "published" }, "ATG · Live"],
    ["draft", { remoteStatus: "closed", soldLotCount: 2 }, "ATG · Ended"],
    ["draft", { remoteStatus: "closed" }, "ATG · Closed"],
    ["cancelled", { remoteStatus: "created" }, null],
  ] as const)("a %s sale linked as %j shows %s", (status, link, label) => {
    renderShell(status, selling(status, link));
    if (label === null) {
      expect(badge()).toBeNull();
      return;
    }
    expect(badge()).toHaveTextContent(label);
  });

  it("links an ATG badge to the sale's ATG tab and explains it to screen readers", () => {
    renderShell("draft", selling("draft", { remoteStatus: "published" }));
    const link = within(badge() as HTMLElement).getByRole("link");
    expect(link).toHaveAttribute("href", "/admin/sales/sale_1/atg");
    expect(link).toHaveAccessibleDescription(/Publish, cancel and delete are disabled here/);
  });

  it("does not link a lax.bid badge, but keeps it focusable for its explanation", () => {
    renderShell("scheduled", selling("scheduled"));
    expect(within(badge() as HTMLElement).queryByRole("link")).toBeNull();
    expect(badge()?.querySelector("[tabindex='0']")).toHaveAccessibleDescription(
      /Bidding happens on lax.bid/,
    );
  });

  it("disables Publish with the ATG reason while ATG owns the sale", () => {
    renderShell("draft", selling("draft", { remoteStatus: "published" }));
    expect(screen.getByRole("button", { name: /publish sale/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("leaves Publish enabled for a linked draft ATG does not own", () => {
    renderShell("draft", selling("draft", { remoteStatus: "closed" }));
    const publish = screen.getByRole("button", { name: /publish sale/i });
    expect(publish).not.toHaveAttribute("aria-disabled");
    fireEvent.click(publish);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
