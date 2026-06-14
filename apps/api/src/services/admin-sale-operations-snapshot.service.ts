import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, saleroomSession } from "@auction/db/schema";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, eq, sql } from "drizzle-orm";
import type { ISaleRegistrationService } from "./interfaces/sale-registration-service.js";
import type { ITelephoneBidBookingService } from "./interfaces/telephone-bid-booking-service.js";

export type AdminSaleOperationsSnapshot = {
  sale: {
    id: string;
    title: string;
    status: string;
    deliveryMode: string;
    startTime: Date | null;
    venueName: string | null;
    streamUrl: string | null;
  };
  saleroomSession: {
    status: string;
    currentLotId: string | null;
    currentLotNumber: number | null;
    currentLotTitle: string | null;
  } | null;
  currentLotBidding: {
    currentPrice: string;
    leaderRef: string | null;
    bidCount: number;
  } | null;
  registrations: { pending: number; approved: number; rejected: number };
  telephoneBookings: {
    requested: number;
    confirmed: number;
    inProgress: number;
    completed: number;
  };
  pendingActions: {
    registrations: Awaited<ReturnType<ISaleRegistrationService["listForSaleAdmin"]>>;
    telephone: Awaited<ReturnType<ITelephoneBidBookingService["listForSaleAdmin"]>>;
  };
};

export class AdminSaleOperationsSnapshotService {
  constructor(
    private readonly db: Database,
    private readonly saleRegistrationService: ISaleRegistrationService,
    private readonly telephoneBidBookingService: ITelephoneBidBookingService,
  ) {}

  async getSnapshot(saleId: string): Promise<AdminSaleOperationsSnapshot | null> {
    const [saleRow] = await this.db
      .select({
        id: sale.id,
        title: sale.title,
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        locationName: sale.locationName,
        streamUrl: sale.streamUrl,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    if (
      !saleRow ||
      !isSaleroomDeliveryMode(saleRow.deliveryMode as "online" | "onsite" | "hybrid")
    ) {
      return null;
    }

    const [session] = await this.db
      .select()
      .from(saleroomSession)
      .where(eq(saleroomSession.saleId, saleId))
      .limit(1);

    let currentLotBidding: AdminSaleOperationsSnapshot["currentLotBidding"] = null;
    let currentLotNumber: number | null = null;
    let currentLotTitle: string | null = null;

    if (session?.currentLotId) {
      const [lotRow] = await this.db
        .select({
          lotNumber: lot.lotNumber,
          title: lot.title,
          currentPrice: lot.currentPrice,
        })
        .from(lot)
        .where(and(eq(lot.id, session.currentLotId), lotNotDeleted()))
        .limit(1);
      if (lotRow) {
        currentLotNumber = lotRow.lotNumber;
        currentLotTitle = lotRow.title;
        const [countRow] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(bid)
          .where(eq(bid.lotId, session.currentLotId));
        const [winner] = await this.db
          .select({ bidderId: bid.bidderId })
          .from(bid)
          .where(and(eq(bid.lotId, session.currentLotId), eq(bid.isWinning, true)))
          .limit(1);
        currentLotBidding = {
          currentPrice: String(lotRow.currentPrice),
          leaderRef: winner?.bidderId ?? null,
          bidCount: countRow?.count ?? 0,
        };
      }
    }

    const allRegs = await this.saleRegistrationService.listForSaleAdmin({ saleId });
    const allTel = await this.telephoneBidBookingService.listForSaleAdmin(saleId);

    return {
      sale: {
        id: saleRow.id,
        title: saleRow.title,
        status: saleRow.status,
        deliveryMode: saleRow.deliveryMode,
        startTime: saleRow.startTime,
        venueName: saleRow.locationName,
        streamUrl: saleRow.streamUrl,
      },
      saleroomSession: session
        ? {
            status: session.status,
            currentLotId: session.currentLotId,
            currentLotNumber,
            currentLotTitle,
          }
        : null,
      currentLotBidding,
      registrations: {
        pending: allRegs.filter((r) => r.status === "pending").length,
        approved: allRegs.filter((r) => r.status === "approved").length,
        rejected: allRegs.filter((r) => r.status === "rejected").length,
      },
      telephoneBookings: {
        requested: allTel.filter((r) => r.status === "requested").length,
        confirmed: allTel.filter((r) => r.status === "confirmed").length,
        inProgress: allTel.filter((r) => r.status === "in_progress").length,
        completed: allTel.filter((r) => r.status === "completed").length,
      },
      pendingActions: {
        registrations: allRegs.filter((r) => r.status === "pending").slice(0, 5),
        telephone: allTel.filter((r) => r.status === "requested").slice(0, 5),
      },
    };
  }
}
