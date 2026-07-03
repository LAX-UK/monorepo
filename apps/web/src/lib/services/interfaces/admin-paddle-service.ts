import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import type { ServiceResult } from "../http/service-result";

export type AdminCheckInInput = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  assignPaddle: boolean;
  bidLimit?: number | undefined;
  paddleNumber?: number | undefined;
};

export type AdminCheckInResult = {
  registrationId: string;
  paddleNumber: number | null;
  checkedInAt: string;
  bidLimit?: string;
};

export type AdminPaddlePlaceBidInput = {
  saleId: string;
  lotId: string;
  paddleNumber: number;
  amount: number;
  maxAutoBidAmount?: number | undefined;
};

export interface IAdminPaddleService {
  checkInCandidates(
    saleId: string,
    q: string,
  ): Promise<ServiceResult<{ items: AdminCheckInCandidate[] }>>;
  checkIn(input: AdminCheckInInput): Promise<ServiceResult<AdminCheckInResult>>;
  assignPaddle(
    saleId: string,
    registrationId: string,
    paddleNumber?: number | undefined,
  ): Promise<ServiceResult<{ paddleNumber: number }>>;
  clearPaddle(saleId: string, registrationId: string): Promise<ServiceResult<{ ok: true }>>;
  placeBid(input: AdminPaddlePlaceBidInput): Promise<ServiceResult<{ bidId: string }>>;
}
