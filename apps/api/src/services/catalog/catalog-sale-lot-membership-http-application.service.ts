import type { UserRole } from "@auction/types";
import { LotError } from "../../lib/errors.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import type { ILotLifecycleTransitionExecutor } from "../interfaces/catalog-routes/catalog-lot-lifecycle-transition-executor.js";
import {
  type CatalogRouteOutcome,
  catalogRouteFromResult,
} from "../interfaces/catalog-routes/catalog-route-http.js";
import type {
  ICatalogSaleLotMembershipHttpApplicationService,
  PresentedLot,
} from "../interfaces/catalog-routes/catalog-sale-lot-membership-http.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { ISaleService } from "../interfaces/sale-service.js";

export class CatalogSaleLotMembershipHttpApplicationService
  implements ICatalogSaleLotMembershipHttpApplicationService
{
  constructor(
    private readonly saleService: ISaleService,
    private readonly lotService: ILotService,
    private readonly lotLifecycleTransitionExecutor: ILotLifecycleTransitionExecutor,
    private readonly mediaUrlResolver: IMediaUrlResolver,
    private readonly mediaAssetEnricher: IMediaAssetEnricher,
  ) {}

  private async present(lot: PresentedLot): Promise<PresentedLot> {
    return presentLotImages(this.mediaUrlResolver, lot, this.mediaAssetEnricher);
  }

  async addLot(input: {
    role: UserRole;
    saleId: string;
    body: Parameters<ISaleService["addLot"]>[2];
    staffRole: string | null;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const result = await this.saleService.addLot(
      input.role,
      input.saleId,
      input.body,
      input.staffRole,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value), status: 201 };
  }

  async attachExistingLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    via: "attach_endpoint" | "wizard";
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const result = await this.saleService.attachExistingLot(
      input.role,
      input.saleId,
      input.lotId,
      input.staffRole,
      input.via,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async detachLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
  }): Promise<CatalogRouteOutcome<void>> {
    const result = await this.saleService.detachLot(
      input.role,
      input.saleId,
      input.lotId,
      input.staffRole,
    );
    return catalogRouteFromResult(result);
  }

  async cancelLotOnSale(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const lot = await this.lotService.getById(input.lotId);
    if (!lot || lot.saleId !== input.saleId) {
      return { kind: "err", error: new LotError("Lot not found in this sale", 404) };
    }
    const result = await this.lotLifecycleTransitionExecutor.cancelLot({
      userId: input.userId,
      role: input.role,
      lotId: input.lotId,
      staffRole: input.staffRole,
      cancelReason: input.reason?.trim() ? "admin_override" : "manual",
    });
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async setLotStatus(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    status: Parameters<ILotLifecycleTransitionExecutor["applyStaffLotStatus"]>[0]["status"];
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    if (input.status === "cancelled") {
      return this.cancelLotOnSale({
        userId: input.userId,
        role: input.role,
        saleId: input.saleId,
        lotId: input.lotId,
        staffRole: input.staffRole,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      });
    }
    const result = await this.lotLifecycleTransitionExecutor.applyStaffLotStatus({
      role: input.role,
      saleId: input.saleId,
      lotId: input.lotId,
      status: input.status,
      staffRole: input.staffRole,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    });
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }
}
