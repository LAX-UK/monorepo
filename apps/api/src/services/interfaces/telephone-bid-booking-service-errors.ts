export type { TelephoneBidBookingDetail } from "@auction/persistence/interfaces";

export type TelephoneBidBookingServiceError = {
  message: string;
  status: number;
  code?: string;
  /** Facts a clerk needs to phrase the refusal (for example the booking's maximum). */
  details?: Readonly<Record<string, string>>;
};
