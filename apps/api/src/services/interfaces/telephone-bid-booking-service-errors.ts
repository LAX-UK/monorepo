export type { TelephoneBidBookingDetail } from "@auction/persistence/interfaces";

export type TelephoneBidBookingServiceError = {
  message: string;
  status: number;
  code?: string;
};
