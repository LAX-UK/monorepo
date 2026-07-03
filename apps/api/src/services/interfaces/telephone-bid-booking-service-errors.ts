export type { TelephoneBidBookingDetail } from "@auction/persistence";

export type TelephoneBidBookingServiceError = {
  message: string;
  status: number;
  code?: string;
};
