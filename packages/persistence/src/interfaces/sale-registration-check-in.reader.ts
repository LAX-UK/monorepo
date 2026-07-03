export type SaleCheckInGateRow = {
  id: string;
  status: string;
  deliveryMode: string;
};

export type UserCheckInGateRow = {
  id: string;
  emailVerified: boolean;
  kycStatus: string;
  suspendedAt: Date | null;
};

export interface ISaleRegistrationCheckInReader {
  findSaleForCheckIn(saleId: string): Promise<SaleCheckInGateRow | null>;
  findUserForCheckIn(userId: string): Promise<UserCheckInGateRow | null>;
}
