export type CreateOriginalSaleCommand = {
  artworkId: string;
  buyerPartyId: string;
  salePricePence: number;
  reservationExpiresAt?: string | undefined;
  actorSubjectId: string;
};

export type CreateOriginalSaleResult = {
  originalSaleId: string;
  status: "reserved";
};

export interface OriginalSaleWriter {
  createReservation(command: CreateOriginalSaleCommand): Promise<CreateOriginalSaleResult>;
}
