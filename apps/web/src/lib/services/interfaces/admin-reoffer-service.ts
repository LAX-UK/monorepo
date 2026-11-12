import type {
  RecordSellerAnswerBody,
  SendReofferBody,
  WithdrawReofferBody,
} from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

/** What starting an offer answers: where the offer begins and who must say yes first. */
export type StartedReoffer = {
  reofferId: string;
  status: "awaiting_seller" | "ready";
};

/** Staff steps of an offer to the next bidder after a buyer default. */
export interface IAdminReofferService {
  start(lotId: string, buyerDefaultId?: string): Promise<ServiceResult<StartedReoffer>>;
  recordSellerAnswer(
    reofferId: string,
    body: RecordSellerAnswerBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  send(reofferId: string, body: SendReofferBody): Promise<ServiceResult<Record<string, unknown>>>;
  withdraw(
    reofferId: string,
    body: WithdrawReofferBody,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}
