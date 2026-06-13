import { gbpAmountToPence, gbpPenceToMajorString } from "../../lib/decimal-money.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IPlatformFeePolicy } from "../interfaces/platform-fee.js";

const DEFAULT_PLATFORM_FEE_BPS = 500;

export class PlatformFeePolicy implements IPlatformFeePolicy {
  constructor(private readonly legalEntities: ILegalEntityRepository | null) {}

  async computePlatformFee(sellerLegalEntityId: string, totalDueMajor: number): Promise<string> {
    const safeTotal = Number.isFinite(totalDueMajor) ? totalDueMajor : 0;
    return this.computePlatformFeeFromPence(
      sellerLegalEntityId,
      gbpAmountToPence(safeTotal.toFixed(2)),
    );
  }

  async computePlatformFeeFromPence(
    sellerLegalEntityId: string,
    totalDuePence: number,
  ): Promise<string> {
    const safePence = Number.isFinite(totalDuePence) ? totalDuePence : 0;
    let bps = DEFAULT_PLATFORM_FEE_BPS;
    if (this.legalEntities) {
      const entity = await this.legalEntities.findById(sellerLegalEntityId);
      if (entity?.platformFeeBps != null && entity.platformFeeBps >= 0) {
        bps = entity.platformFeeBps;
      }
    }
    return gbpPenceToMajorString(Math.round((safePence * bps) / 10_000));
  }
}
