import {
  DEFAULT_LOT_ATTENTION_CONTRIBUTORS,
  type LotAttentionPrincipal,
  type LotAttentionResult,
  composeLotAttention,
} from "@auction/domain";
import type {
  IAdminReviewTaskRepository,
  ILegalEntityRepository,
  ILotRepository,
} from "@auction/persistence/interfaces";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";

export class LotAttentionNotFoundError extends Error {
  constructor(lotId: string) {
    super(`Lot not found: ${lotId}`);
    this.name = "LotAttentionNotFoundError";
  }
}

export interface IAdminLotAttentionService {
  getAttention(
    lotId: string,
    principal: LotAttentionPrincipal,
    options?: { limit?: number },
  ): Promise<LotAttentionResult>;
}

export class AdminLotAttentionService implements IAdminLotAttentionService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly reviewTaskRepository: IAdminReviewTaskRepository,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly contributors = DEFAULT_LOT_ATTENTION_CONTRIBUTORS,
  ) {}

  async getAttention(
    lotId: string,
    principal: LotAttentionPrincipal,
    options: { limit?: number } = {},
  ): Promise<LotAttentionResult> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) {
      throw new LotAttentionNotFoundError(lotId);
    }

    const connectMap = await buildConnectRequiredByLotId(
      [lot],
      this.legalEntityRepository,
      this.stripeConnectService.isConfigured(),
    );
    const connectRequired = connectMap.get(lotId) ?? false;

    const withdrawalPending =
      (await this.reviewTaskRepository.findPendingLotWithdrawal(lotId)) != null;

    const images = lot.images ?? [];
    const description = lot.description ?? null;
    const readinessChecks = [
      images.length > 0,
      Boolean(description?.trim()),
      Boolean(lot.sellerLegalEntityId),
      Boolean(lot.artistId),
    ];
    const publishReadinessPercent = Math.round(
      (readinessChecks.filter(Boolean).length / readinessChecks.length) * 100,
    );

    return composeLotAttention(
      {
        lot: {
          id: lot.id,
          status: lot.status,
          title: lot.title,
          images,
          description,
          sellerLegalEntityId: lot.sellerLegalEntityId ?? null,
        },
        connectRequired,
        withdrawalPending,
        publishReadinessPercent,
      },
      this.contributors,
      {
        principal,
        ...(options.limit != null ? { limit: options.limit } : {}),
      },
    );
  }
}
