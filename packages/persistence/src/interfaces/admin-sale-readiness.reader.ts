export type AdminSaleReadinessSourceRow = {
  saleId: string;
  title: string;
  status: string;
  deliveryMode: string;
  startTime: Date | null;
  lotsTotal: number;
  lotsPublished: number;
  lotsDraft: number;
  lotsMissingPhotos: number;
  lotsMissingEstimates: number;
  pendingRegistrations: number;
  pendingTelephoneBookings: number;
  sessionStatus: string | null;
};

export interface IAdminSaleReadinessReader {
  listUpcomingAndLiveSales(limit: number): Promise<AdminSaleReadinessSourceRow[]>;
}
