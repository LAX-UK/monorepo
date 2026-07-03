import type { IAdminSaleOperationsSnapshotReader } from "@auction/persistence";
import { isSaleroomDeliveryMode } from "@auction/validators";
import type { ISaleRegistrationService } from "./interfaces/sale-registration-service.js";
import type { ITelephoneBidBookingQueryService } from "./interfaces/telephone-bid-booking-service.js";

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
    telephone: Awaited<ReturnType<ITelephoneBidBookingQueryService["listForSaleAdmin"]>>;
  };
};

export class AdminSaleOperationsSnapshotService {
  constructor(
    private readonly reader: IAdminSaleOperationsSnapshotReader,
    private readonly saleRegistrationService: ISaleRegistrationService,
    private readonly telephoneBidBookingService: ITelephoneBidBookingQueryService,
  ) {}

  async getSnapshot(saleId: string): Promise<AdminSaleOperationsSnapshot | null> {
    const saleRow = await this.reader.findSaleroomSale(saleId);
    if (
      !saleRow ||
      !isSaleroomDeliveryMode(saleRow.deliveryMode as "online" | "onsite" | "hybrid")
    ) {
      return null;
    }

    const session = await this.reader.findSession(saleId);

    let currentLotBidding: AdminSaleOperationsSnapshot["currentLotBidding"] = null;
    let currentLotNumber: number | null = null;
    let currentLotTitle: string | null = null;

    if (session?.currentLotId) {
      const lotRow = await this.reader.findCurrentLot(session.currentLotId);
      if (lotRow) {
        currentLotNumber = lotRow.lotNumber;
        currentLotTitle = lotRow.title;
        currentLotBidding = await this.reader.loadCurrentLotBidding(session.currentLotId);
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
