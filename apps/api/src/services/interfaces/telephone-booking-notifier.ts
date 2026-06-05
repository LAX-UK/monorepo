import type { TelephoneBidBooking } from "@auction/types";

export interface ITelephoneBookingNotifier {
  notifyRequested(booking: TelephoneBidBooking): Promise<void>;
  notifyConfirmed(booking: TelephoneBidBooking): Promise<void>;
  notifyCancelledByStaff(booking: TelephoneBidBooking, reason?: string | null): Promise<void>;
  notifyLimitIncreaseApproved(booking: TelephoneBidBooking): Promise<void>;
}
