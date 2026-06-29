import type { Redis } from "ioredis";
import { type Result, err } from "neverthrow";
import { checkPaddleAssignRateLimit } from "../../lib/paddle-assign-rate-limit.js";
import type { IAdminSaleroomCheckInApplicationService } from "../interfaces/admin-routes.js";
import type {
  ISaleroomCheckInService,
  SaleroomCheckInServiceError,
  SaleroomCheckInSuccess,
} from "../interfaces/saleroom-check-in-service.js";

type CheckInRateLimitError = {
  message: string;
  status: 429;
  code: "rate_limited";
};

export class AdminSaleroomCheckInApplicationService
  implements IAdminSaleroomCheckInApplicationService
{
  constructor(
    private readonly checkIn: ISaleroomCheckInService,
    private readonly redis: Redis,
  ) {}

  searchCandidates(...args: Parameters<ISaleroomCheckInService["searchCandidates"]>) {
    return this.checkIn.searchCandidates(...args);
  }

  async checkInBidder(
    input: Parameters<ISaleroomCheckInService["checkInBidder"]>[0],
  ): Promise<Result<SaleroomCheckInSuccess, SaleroomCheckInServiceError | CheckInRateLimitError>> {
    const allowed = await checkPaddleAssignRateLimit(this.redis, input.decidedByUserId);
    if (!allowed) {
      return err({
        message: "Too many check-in attempts",
        status: 429,
        code: "rate_limited",
      });
    }
    return this.checkIn.checkInBidder(input);
  }
}
