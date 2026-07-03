export type TelephoneBookingPlacementRow = {
  saleId: string;
  status: string;
};

export type TelephoneBookingCapRow = {
  reserveAltMax: string | null;
};

export type PaddleRegistrationRow = {
  bidLimit: string | null;
  status: string;
};

export interface IOperatorPlacementReader {
  findTelephoneBookingPlacement(bookingId: string): Promise<TelephoneBookingPlacementRow | null>;
  findTelephoneBookingCap(bookingId: string): Promise<TelephoneBookingCapRow | null>;
  findPaddleRegistration(
    saleId: string,
    paddleNumber: number,
  ): Promise<PaddleRegistrationRow | null>;
}
