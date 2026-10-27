import type { TelephoneBidBooking } from "@auction/types";
import type { IAdminTelephoneBookingApplicationService } from "../interfaces/admin-routes/admin-telephone-booking-routes.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromServiceResult,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type {
  ITelephoneBidBookingQueryService,
  ITelephoneBidBookingStaffService,
} from "../interfaces/telephone-bid-booking-service.js";
import type { ITelephoneClerkEligibility } from "./telephone-clerk-eligibility.js";

export class AdminTelephoneBookingApplicationService
  implements IAdminTelephoneBookingApplicationService
{
  constructor(
    private readonly staff: ITelephoneBidBookingStaffService,
    private readonly query: ITelephoneBidBookingQueryService,
    private readonly clerks: ITelephoneClerkEligibility,
  ) {}

  async countGlobalPending(): Promise<{ count: number }> {
    const count = await this.query.countGlobalPending();
    return { count };
  }

  async listForSaleAdmin(
    input: Parameters<IAdminTelephoneBookingApplicationService["listForSaleAdmin"]>[0],
  ) {
    const items = await this.query.listForSaleAdmin(input.saleId, input.status);
    return { items };
  }

  private async withBookingOnSale<T>(
    saleId: string,
    bookingId: string,
    run: () => Promise<BiddingRouteOutcome<T>>,
  ): Promise<BiddingRouteOutcome<T>> {
    const scoped = await this.staff.assertBookingBelongsToSale(bookingId, saleId);
    if (scoped.isErr()) {
      return { kind: "err", error: scoped.error };
    }
    return run();
  }

  confirm(
    input: Parameters<IAdminTelephoneBookingApplicationService["confirm"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.confirm({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
        }),
      ),
    );
  }

  assignClerk(
    input: Parameters<IAdminTelephoneBookingApplicationService["assignClerk"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () => {
      if (!(await this.clerks.canTakeTelephoneLines(input.clerkUserId))) {
        return {
          kind: "err",
          error: {
            message:
              "That person cannot take telephone lines; choose a member of the saleroom team",
            status: 400,
            code: "clerk_not_eligible",
          },
        };
      }
      return biddingRouteFromServiceResult(
        await this.staff.assignClerk({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
          clerkUserId: input.clerkUserId,
        }),
      );
    });
  }

  approveLimitIncrease(
    input: Parameters<IAdminTelephoneBookingApplicationService["approveLimitIncrease"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.approveLimitIncrease({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
        }),
      ),
    );
  }

  startLine(
    input: Parameters<IAdminTelephoneBookingApplicationService["startLine"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.startLine({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
          lotId: input.lotId,
        }),
      ),
    );
  }

  completeLine(
    input: Parameters<IAdminTelephoneBookingApplicationService["completeLine"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.completeLine({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
          lotId: input.lotId,
        }),
      ),
    );
  }

  closeBooking(
    input: Parameters<IAdminTelephoneBookingApplicationService["closeBooking"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.closeBooking({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
        }),
      ),
    );
  }

  cancelByStaff(
    input: Parameters<IAdminTelephoneBookingApplicationService["cancelByStaff"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.cancelByStaff({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
        }),
      ),
    );
  }

  updateNotes(
    input: Parameters<IAdminTelephoneBookingApplicationService["updateNotes"]>[0],
  ): Promise<BiddingRouteOutcome<TelephoneBidBooking>> {
    return this.withBookingOnSale(input.saleId, input.bookingId, async () =>
      biddingRouteFromServiceResult(
        await this.staff.updateNotes({
          bookingId: input.bookingId,
          staffUserId: input.staffUserId,
          notes: input.notes,
        }),
      ),
    );
  }
}
