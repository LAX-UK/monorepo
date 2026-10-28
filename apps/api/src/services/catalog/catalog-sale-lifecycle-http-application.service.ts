import { type StaffRoles, type UserRole, roleHasCapability } from "@auction/types";
import { LotError } from "../../lib/errors.js";
import { presentSaleImages, presentSalesWithLotsImages } from "../../lib/media-presenters.js";
import {
  type CatalogRouteOutcome,
  catalogRouteFromResult,
} from "../interfaces/catalog-routes/catalog-route-http.js";
import type {
  BulkSoftDeleteSalesOutcome,
  ICatalogSaleLifecycleHttpApplicationService,
  PresentedSale,
  PresentedSaleWithLots,
} from "../interfaces/catalog-routes/catalog-sale-lifecycle-http.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { ISaleService } from "../interfaces/sale-service.js";
import type { ISaleSoftDeleteService } from "../interfaces/sale-soft-delete.js";
import type { ISaleStatusTransitionService } from "../interfaces/sale-status-transition.js";

export class CatalogSaleLifecycleHttpApplicationService
  implements ICatalogSaleLifecycleHttpApplicationService
{
  constructor(
    private readonly saleService: ISaleService,
    private readonly saleSoftDeleteService: ISaleSoftDeleteService,
    private readonly saleStatusTransitionService: ISaleStatusTransitionService,
    private readonly mediaUrlResolver: IMediaUrlResolver,
    private readonly mediaAssetEnricher: IMediaAssetEnricher,
  ) {}

  async bulkSoftDelete(input: {
    userId: string;
    role: UserRole;
    ids: string[];
    confirmationPhrase: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<BulkSoftDeleteSalesOutcome>> {
    const result = await this.saleSoftDeleteService.bulkSoftDelete(
      input.userId,
      input.role,
      input.ids,
      input.confirmationPhrase,
      input.staffRoles,
    );
    return catalogRouteFromResult(result);
  }

  async createSale(input: {
    userId: string;
    role: UserRole;
    staffRoles: StaffRoles | undefined;
    body: Parameters<ISaleService["create"]>[1];
  }): Promise<CatalogRouteOutcome<PresentedSale>> {
    const staff = input.staffRoles;
    if (!roleHasCapability(input.role, "auction.manage", staff)) {
      return {
        kind: "err",
        error: new LotError("Only staff with auction.manage can create sales", 403),
      };
    }
    try {
      const sale = await this.saleService.create(input.userId, input.body);
      const data = await presentSaleImages(this.mediaUrlResolver, sale, this.mediaAssetEnricher);
      return { kind: "ok", data, status: 201 };
    } catch (e) {
      if (e instanceof LotError) return { kind: "err", error: e };
      throw e;
    }
  }

  async updateDraft(input: {
    role: UserRole;
    saleId: string;
    patch: Parameters<ISaleService["updateDraft"]>[2];
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>> {
    const result = await this.saleService.updateDraft(
      input.role,
      input.saleId,
      input.patch,
      input.staffRoles,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    const data = await presentSaleImages(
      this.mediaUrlResolver,
      result.value,
      this.mediaAssetEnricher,
    );
    return { kind: "ok", data };
  }

  async publish(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSaleWithLots>> {
    const result = await this.saleService.publish(
      input.userId,
      input.role,
      input.saleId,
      input.staffRoles,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    const [data] = await presentSalesWithLotsImages(this.mediaUrlResolver, [result.value]);
    return { kind: "ok", data: data ?? { sale: result.value.sale, lots: result.value.lots } };
  }

  async unpublish(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>> {
    const result = await this.saleService.unpublish(
      input.userId,
      input.role,
      input.saleId,
      input.staffRoles,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    const data = await presentSaleImages(
      this.mediaUrlResolver,
      result.value,
      this.mediaAssetEnricher,
    );
    return { kind: "ok", data };
  }

  async cancel(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>> {
    const result = await this.saleService.cancel(
      input.userId,
      input.role,
      input.saleId,
      input.staffRoles,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    const data = await presentSaleImages(
      this.mediaUrlResolver,
      result.value,
      this.mediaAssetEnricher,
    );
    return { kind: "ok", data };
  }

  async softDelete(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    confirmationPhrase: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<{ kind: "no_content" } | { kind: "err"; error: Error }> {
    const result = await this.saleSoftDeleteService.softDelete(
      input.userId,
      input.role,
      input.saleId,
      input.confirmationPhrase,
      input.staffRoles,
    );
    if (result.isErr()) return { kind: "err", error: result.error };
    return { kind: "no_content" };
  }

  async markOnsiteSaleEnded(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    reason: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSaleWithLots>> {
    const result = await this.saleStatusTransitionService.markOnsiteSaleEnded(
      input.role,
      input.saleId,
      input.reason,
      input.staffRoles,
      input.userId,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    const [data] = await presentSalesWithLotsImages(this.mediaUrlResolver, [result.value]);
    return { kind: "ok", data: data ?? { sale: result.value.sale, lots: result.value.lots } };
  }
}
