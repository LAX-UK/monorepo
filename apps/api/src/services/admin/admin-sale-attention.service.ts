import {
  DEFAULT_SALE_ATTENTION_CONTRIBUTORS,
  type SaleAttentionPrincipal,
  type SaleAttentionResult,
  composeSaleAttention,
  resolveNeededSignalKeys,
} from "@auction/domain";
import type { ISaleAttentionSignalsReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { isOnsiteLocationReadyForPublish, isStartInFutureForPublish } from "@auction/validators";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";

import type { IStripeConnectService } from "../interfaces/stripe-connect.js";

export class SaleAttentionNotFoundError extends Error {
  constructor(saleId: string) {
    super(`Sale not found: ${saleId}`);
    this.name = "SaleAttentionNotFoundError";
  }
}

export interface IAdminSaleAttentionService {
  getAttention(
    saleId: string,
    principal: SaleAttentionPrincipal,
    options?: { limit?: number },
  ): Promise<SaleAttentionResult>;
}

export class AdminSaleAttentionService implements IAdminSaleAttentionService {
  constructor(
    private readonly signalsReader: ISaleAttentionSignalsReader,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly contributors = DEFAULT_SALE_ATTENTION_CONTRIBUTORS,
  ) {}

  async getAttention(
    saleId: string,
    principal: SaleAttentionPrincipal,
    options: { limit?: number } = {},
  ): Promise<SaleAttentionResult> {
    const saleProbe = await this.signalsReader.load(saleId, ["sale"]);
    if (saleProbe.notFound || !saleProbe.sale) {
      throw new SaleAttentionNotFoundError(saleId);
    }

    const needs = resolveNeededSignalKeys(saleProbe.sale.status, this.contributors, principal);
    const signals = await this.signalsReader.load(saleId, needs);

    if (signals.notFound || !signals.sale) {
      throw new SaleAttentionNotFoundError(saleId);
    }

    signals.venueReady = isOnsiteLocationReadyForPublish(signals.sale);
    signals.startInFuture = isStartInFutureForPublish(signals.sale.startTime);

    if (needs.includes("connectByLotId") && signals.lots?.length) {
      const connectMap = await buildConnectRequiredByLotId(
        signals.lots,
        this.legalEntityRepository,
        this.stripeConnectService.isConfigured(),
      );
      signals.connectRequiredByLotId = Object.fromEntries(connectMap.entries());
    }

    return composeSaleAttention(signals, this.contributors, {
      principal,
      ...(options.limit != null ? { limit: options.limit } : {}),
    });
  }
}
