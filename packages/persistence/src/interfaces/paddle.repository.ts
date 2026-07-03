export type PaddleRegistrationRow = {
  registrationId: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  paddleNumber: number;
  bidLimit: string | null;
  userName: string | null;
  userEmail: string | null;
  kycStatus: string;
};

export interface IPaddleRepository {
  findBySaleAndPaddle(saleId: string, paddleNumber: number): Promise<PaddleRegistrationRow | null>;
  findRegistrationById(
    saleId: string,
    registrationId: string,
  ): Promise<{
    id: string;
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    kycStatus: string;
    preferredPaddleNumber: number | null;
  } | null>;
  listRosterForSale(saleId: string): Promise<PaddleRegistrationRow[]>;
  nextPaddleNumber(saleId: string): Promise<number>;
  isPaddleFree(saleId: string, paddleNumber: number): Promise<boolean>;
  assignPaddle(input: {
    registrationId: string;
    paddleNumber: number;
    checkedInAt: Date;
  }): Promise<void>;
  clearPaddle(registrationId: string): Promise<void>;
  updatePreferredPaddle(userId: string, paddleNumber: number): Promise<void>;
}
