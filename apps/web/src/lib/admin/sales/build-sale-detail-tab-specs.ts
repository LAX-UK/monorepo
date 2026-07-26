import type { CatalogDetailTabSpec } from "@/lib/admin/catalog/catalog-detail-tab.types";
import { saleDetailTabHref } from "@/lib/admin/sales/sale-detail-routes";
import type { Sale, SaleDeliveryMode } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type BuildSaleDetailTabSpecsInput = {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  liveish: boolean;
  lotCount: number;
  saleStatus: Sale["status"];
  registrationCount?: number | null;
  pendingRegistrationCount: number;
  pendingTelephoneBookingCount: number;
  documentCount?: number | null;
  overviewAttentionCount: number;
};

/** Capability-driven sale detail tab nav — single place for tab visibility rules. */
export function buildSaleDetailTabSpecs(
  input: BuildSaleDetailTabSpecsInput,
): CatalogDetailTabSpec[] {
  const {
    saleId,
    deliveryMode,
    liveish,
    lotCount,
    saleStatus,
    registrationCount = null,
    pendingRegistrationCount,
    pendingTelephoneBookingCount,
    documentCount = null,
    overviewAttentionCount,
  } = input;

  const isSaleroom = isSaleroomDeliveryMode(deliveryMode);
  const pendingRegs = liveish && pendingRegistrationCount > 0 ? pendingRegistrationCount : 0;
  const pendingTelephone =
    isSaleroom && pendingTelephoneBookingCount > 0 ? pendingTelephoneBookingCount : 0;

  const tabs: CatalogDetailTabSpec[] = [
    {
      id: "overview",
      label: "Overview",
      href: saleDetailTabHref(saleId, "overview"),
      ...(overviewAttentionCount > 0 ? { count: overviewAttentionCount } : {}),
    },
    {
      id: "lots",
      label: "Lots",
      href: saleDetailTabHref(saleId, "lots"),
      count: lotCount,
      ...(saleStatus === "draft" && lotCount === 0 ? { badge: "warning" as const } : {}),
    },
    {
      id: "registrations",
      label: "Registrations",
      href: saleDetailTabHref(saleId, "registrations"),
      ...(liveish && registrationCount != null ? { count: registrationCount } : {}),
      ...(pendingRegs > 0 ? { badge: "pending" as const } : {}),
    },
    {
      id: "documents",
      label: "Documents",
      href: saleDetailTabHref(saleId, "documents"),
      count: documentCount ?? 0,
    },
    {
      id: "press",
      label: "Press",
      href: saleDetailTabHref(saleId, "press"),
    },
    {
      id: "schedule",
      label: "Schedule",
      href: saleDetailTabHref(saleId, "schedule"),
    },
  ];

  if (isSaleroom) {
    tabs.splice(4, 0, {
      id: "media",
      label: "Media",
      href: saleDetailTabHref(saleId, "media"),
    });
    tabs.push(
      {
        id: "operations",
        label: "Operations",
        href: saleDetailTabHref(saleId, "operations"),
      },
      {
        id: "telephone-bookings",
        label: "Telephone",
        href: saleDetailTabHref(saleId, "telephone-bookings"),
        ...(pendingTelephone > 0 ? { badge: "pending" as const } : {}),
      },
    );
  }

  return tabs;
}
