import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { render, screen } from "@testing-library/react";
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
    children,
  }: {
    actions?: React.ReactNode;
    aside?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
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
});
