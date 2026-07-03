import { err, ok } from "neverthrow";
import type { ITelephoneBidBookingStaffService } from "../interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingContext } from "./telephone-bid-booking-context.js";
import { notifyBestEffort, publishTelephoneBookingEvent } from "./telephone-booking-events.js";
import {
  getBookingForSaleOrErr,
  getBookingOrErr,
  telephoneBookingErr,
  validateLotIds,
} from "./telephone-booking-validation.js";

export class TelephoneBidBookingStaffService implements ITelephoneBidBookingStaffService {
  constructor(private readonly ctx: TelephoneBidBookingContext) {}

  async confirm(input: { bookingId: string; staffUserId: string; notes?: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "requested") {
      return telephoneBookingErr(
        "Only requested bookings can be confirmed",
        400,
        "invalid_status_transition",
      );
    }

    const now = new Date();
    const updated = await repo.update(input.bookingId, {
      status: "confirmed",
      confirmedAt: now,
      approvedByUserId: input.staffUserId,
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
    });
    if (!updated) {
      return telephoneBookingErr("Could not confirm booking", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.confirmed", updated);
    notifyBestEffort(eventsDeps, "notifyConfirmed", (notifier) =>
      notifier.notifyConfirmed(updated),
    );
    return ok(updated);
  }

  async assignClerk(input: { bookingId: string; staffUserId: string; clerkUserId: string }) {
    const { repo, validationDeps: deps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr(
        "Cannot assign clerk to a closed booking",
        400,
        "invalid_status_transition",
      );
    }

    const updated = await repo.update(input.bookingId, {
      clerkUserId: input.clerkUserId,
    });
    if (!updated) {
      return telephoneBookingErr("Could not assign clerk", 500);
    }
    return ok(updated);
  }

  async updateNotes(input: { bookingId: string; staffUserId: string; notes: string }) {
    const { repo, validationDeps: deps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;

    const updated = await repo.update(input.bookingId, {
      notes: input.notes.trim(),
    });
    if (!updated) {
      return telephoneBookingErr("Could not update notes", 500);
    }
    return ok(updated);
  }

  async approveLimitIncrease(input: { bookingId: string; staffUserId: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (!found.value.limitIncreaseRequestedAt || !found.value.limitIncreaseAmount) {
      return telephoneBookingErr("No pending limit increase request", 400);
    }

    const updated = await repo.update(input.bookingId, {
      authorizedMax: found.value.limitIncreaseAmount,
      limitIncreaseRequestedAt: null,
      limitIncreaseAmount: null,
    });
    if (!updated) {
      return telephoneBookingErr("Could not approve limit increase", 500);
    }
    await publishTelephoneBookingEvent(
      eventsDeps,
      "telephone_booking.limit_increase_approved",
      updated,
    );
    notifyBestEffort(eventsDeps, "notifyLimitIncreaseApproved", (notifier) =>
      notifier.notifyLimitIncreaseApproved(updated),
    );
    return ok(updated);
  }

  async startLine(input: { bookingId: string; staffUserId: string; lotId: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "confirmed" && found.value.status !== "in_progress") {
      return telephoneBookingErr(
        "Booking must be confirmed before starting a line",
        400,
        "invalid_status_transition",
      );
    }

    const lotsCheck = await validateLotIds(deps, found.value.saleId, [input.lotId]);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await repo.update(input.bookingId, {
      status: "in_progress",
    });
    if (!updated) {
      return telephoneBookingErr("Could not start telephone line", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.line_started", updated, {
      lotId: input.lotId,
    });
    return ok(updated);
  }

  async completeLine(input: { bookingId: string; staffUserId: string; lotId: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "in_progress") {
      return telephoneBookingErr(
        "No active telephone line to complete",
        400,
        "invalid_status_transition",
      );
    }

    const completedLotIds = [...new Set([...found.value.completedLotIds, input.lotId])];
    const updated = await repo.update(input.bookingId, {
      status: "confirmed",
      completedLotIds,
    });
    if (!updated) {
      return telephoneBookingErr("Could not complete telephone line", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.line_completed", updated, {
      lotId: input.lotId,
    });
    return ok(updated);
  }

  async closeBooking(input: { bookingId: string; staffUserId: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await repo.update(input.bookingId, {
      status: "completed",
    });
    if (!updated) {
      return telephoneBookingErr("Could not close booking", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.closed", updated);
    return ok(updated);
  }

  async cancelByStaff(input: { bookingId: string; staffUserId: string; reason?: string }) {
    const { repo, validationDeps: deps, eventsDeps } = this.ctx;
    const found = await getBookingOrErr(deps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.staffUserId,
      cancellationReason: input.reason?.trim() || "staff_cancelled",
    });
    if (!updated) {
      return telephoneBookingErr("Could not cancel booking", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.cancelled", updated);
    notifyBestEffort(eventsDeps, "notifyCancelledByStaff", (notifier) =>
      notifier.notifyCancelledByStaff(updated, input.reason),
    );
    return ok(updated);
  }

  async assertBookingBelongsToSale(bookingId: string, saleId: string) {
    return getBookingForSaleOrErr(this.ctx.validationDeps, bookingId, saleId);
  }
}
