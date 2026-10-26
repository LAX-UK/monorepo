import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { type AtgSaleSellingSummary, toAtgSaleSellingSummary } from "@auction/types";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleDetailShell } from "./sale-detail-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/sales/s1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/admin/catalog", () => ({
  CatalogBreadcrumbs: ({ segments }: { segments: { label: string }[] }) => (
    <nav>{segments.map((s) => s.label).join(" / ")}</nav>
  ),
  CatalogDetailMobileMeta: () => null,
  CatalogDetailShell: ({
    actions,
    aside,
    meta,
    children,
  }: {
    actions?: React.ReactNode;
    aside?: React.ReactNode;
    meta?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="meta">{meta}</div>
      <div data-testid="actions">{actions}</div>
      <div data-testid="aside">{aside}</div>
      {children}
    </div>
  ),
  CatalogDetailStickyMiniBar: () => null,
  CatalogDetailTabNav: () => null,
}));

vi.mock("@/components/admin/admin-sale-header-actions", () => ({
  AdminSaleHeaderActions: ({
    canPublish,
    canEdit,
  }: {
    canPublish?: boolean;
    canEdit?: boolean;
  }) => (
    <div data-testid="header-actions">
      {canPublish ? <span>Publish sale</span> : null}
      {canEdit ? <span>Edit draft</span> : null}
    </div>
  ),
}));

vi.mock("@/components/admin/sale-detail/sale-detail-connect-notice", () => ({
  SaleDetailConnectNotice: () => null,
}));

vi.mock("@/components/admin/sale-detail/sale-context-rail", () => ({
  SaleContextRail: () => <aside data-testid="context-rail" />,
}));

vi.mock("@/components/admin/sale-detail-mobile-lifecycle-trailing", () => ({
  SaleDetailMobileLifecycleTrailing: () => null,
}));

vi.mock("@/components/admin/editable-titles", () => ({
  AdminSaleEditableTitle: ({ value }: { value: string }) => <h1>{value}</h1>,
}));

vi.mock("@/components/admin/admin-pin-page-button", () => ({
  AdminPinPageButton: () => null,
}));

vi.mock("@/components/admin/qr-code/admin-qr-code-button", () => ({
  AdminQrCodeButton: () => <button type="button">QR code</button>,
}));

const baseBundle = {
  sale: {
    id: "s1",
    title: "Test sale",
    status: "draft" as const,
    deliveryMode: "online" as const,
    startTime: new Date(Date.now() + 86_400_000),
    endTime: new Date(Date.now() + 172_800_000),
    previewStartTime: null,
    streamUrl: null,
    locationMapUrl: null,
    locationName: null,
    locationAddress: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: [],
    updatedAt: new Date(),
    createdAt: new Date(),
    images: [],
    description: null,
    slug: "test-sale",
    marketingDetails: {},
  },
  lots: [],
  deleteEligibility: { canDelete: true, blockers: [] },
} as unknown as AdminSaleListRow;

describe("SaleDetailShell", () => {
  it("hides publish and edit actions when canManageSales is false", () => {
    render(
      <SaleDetailShell saleId="s1" bundle={baseBundle} canManageSales={false}>
        <p>Tab content</p>
      </SaleDetailShell>,
    );
    expect(screen.queryByText("Publish sale")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit draft")).not.toBeInTheDocument();
    expect(screen.queryByText("QR code")).not.toBeInTheDocument();
    expect(screen.getByText("Tab content")).toBeInTheDocument();
  });

  it("shows publish and edit actions when canManageSales is true", () => {
    render(
      <SaleDetailShell saleId="s1" bundle={baseBundle} canManageSales>
        <p>Tab content</p>
      </SaleDetailShell>,
    );
    expect(screen.getByText("Publish sale")).toBeInTheDocument();
    expect(screen.getByText("Edit draft")).toBeInTheDocument();
    expect(screen.getByText("QR code")).toBeInTheDocument();
  });

  describe("selling platform badge", () => {
    const summary = (
      input: Partial<Parameters<typeof toAtgSaleSellingSummary>[0]>,
    ): AtgSaleSellingSummary =>
      toAtgSaleSellingSummary({
        saleStatus: "draft",
        atgRemoteStatus: null,
        atgLinked: false,
        atgSoldLotCount: 0,
        atgApprovedAt: null,
        ...input,
      });
    const renderWith = (selling: AtgSaleSellingSummary | null, canManageSales = true) =>
      render(
        <TooltipProvider>
          <SaleDetailShell
            saleId="s1"
            bundle={baseBundle}
            canManageSales={canManageSales}
            selling={selling}
          >
            <p>Tab content</p>
          </SaleDetailShell>
        </TooltipProvider>,
      );

    it("shows nothing for an unlinked draft", () => {
      renderWith(summary({}));
      expect(screen.getByTestId("meta").querySelector("[data-selling-platform]")).toBeNull();
    });

    it("shows lax.bid without a link for a sale selling on lax.bid", () => {
      renderWith(summary({ saleStatus: "scheduled" }));
      const meta = within(screen.getByTestId("meta"));
      expect(meta.getByText("lax.bid").closest("a")).toBeNull();
      expect(meta.getByText("lax.bid").closest("[tabindex='0']")).toHaveAccessibleDescription(
        /lax\.bid/,
      );
    });

    it("links a live ATG sale to its ATG tab, explains it, and hides publish", () => {
      renderWith(summary({ atgLinked: true, atgRemoteStatus: "published" }));
      const link = within(screen.getByTestId("meta")).getByRole("link", { name: "ATG · Live" });
      expect(link).toHaveAttribute("href", "/admin/sales/s1/atg");
      expect(link).toHaveAccessibleDescription(/ATG White Label \(auctions\.lax\.bid\)/);
      expect(screen.queryByText("Publish sale")).not.toBeInTheDocument();
    });

    it.each([
      [{ atgRemoteStatus: "created" as const }, "ATG · Draft"],
      [
        { atgRemoteStatus: "created" as const, atgApprovedAt: "2026-10-20T10:00:00Z" },
        "ATG · Approved",
      ],
      [{ atgRemoteStatus: "closed" as const, atgSoldLotCount: 3 }, "ATG · Ended"],
      [{ atgRemoteStatus: "closed" as const }, "ATG · Closed"],
    ])("labels %o as %s", (input, label) => {
      renderWith(summary({ atgLinked: true, ...input }));
      expect(within(screen.getByTestId("meta")).getByText(label)).toBeInTheDocument();
    });

    it("shows nothing extra for a cancelled sale", () => {
      renderWith(summary({ saleStatus: "cancelled", atgLinked: true, atgRemoteStatus: "created" }));
      expect(screen.getByTestId("meta").querySelector("[data-selling-platform]")).toBeNull();
    });
  });
});
