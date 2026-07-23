import "server-only";

import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import type { AdminSaleListRow } from "@/lib/data/http/admin-sale-registrations.types";
import {
  getAdminSalePaddleRoster,
  getAdminSaleroomSession,
} from "@/lib/data/http/admin-saleroom.reader";
import type { AdminSaleroomSessionSnapshot } from "@/lib/data/http/admin-saleroom.types";
import { getAdminTelephoneBookings } from "@/lib/data/http/admin-telephone.server";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import type { AdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";
import type { SaleDeliveryMode } from "@auction/types";

export type SaleroomClerkPageModel = {
  saleId: string;
  saleTitle: string;
  deliveryMode: SaleDeliveryMode;
  saleStatus: string;
  saleroom: AdminSaleroomSessionSnapshot;
  lots: AdminSaleListRow["lots"];
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster: AdminPaddleRosterEntry[];
  saleroomLoadError: string | null;
  loadWarnings: string[];
  notFound: boolean;
};

type LoadSaleroomClerkPageInput = {
  saleId: string;
};

/** Clerk console bundle for `/admin/saleroom/[saleId]`. */
export async function loadSaleroomClerkPage({
  saleId,
}: LoadSaleroomClerkPageInput): Promise<SaleroomClerkPageModel> {
  let saleroomLoadError: string | null = null;
  const loadWarnings: string[] = [];

  const saleRow = await getAdminSaleById(saleId);
  if (!saleRow) {
    return {
      saleId,
      saleTitle: "Sale",
      deliveryMode: "online",
      saleStatus: "draft",
      saleroom: { session: null, events: [] },
      lots: [],
      telephoneBookings: [],
      paddleRoster: [],
      saleroomLoadError: null,
      loadWarnings: [],
      notFound: true,
    };
  }

  const [saleroomResult, telephoneBookings, paddleRoster] = await Promise.all([
    getAdminSaleroomSession(saleId).catch((e): AdminSaleroomSessionSnapshot => {
      saleroomLoadError = e instanceof Error ? e.message : "Could not load the saleroom session.";
      return { session: null, events: [] };
    }),
    getAdminTelephoneBookings(saleId).catch(() => {
      loadWarnings.push("Telephone bookings could not be loaded.");
      return [];
    }),
    getAdminSalePaddleRoster(saleId).catch(() => {
      loadWarnings.push("Paddle roster could not be loaded.");
      return [];
    }),
  ]);

  return {
    saleId,
    saleTitle: saleRow.sale.title ?? "Sale",
    deliveryMode: saleRow.sale.deliveryMode as SaleDeliveryMode,
    saleStatus: saleRow.sale.status,
    saleroom: saleroomResult,
    lots: saleRow.lots,
    telephoneBookings,
    paddleRoster,
    saleroomLoadError,
    loadWarnings,
    notFound: false,
  };
}
