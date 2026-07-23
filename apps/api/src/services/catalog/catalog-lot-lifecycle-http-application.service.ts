import { type CreateLotInput, type UserRole, normalizeUserStaffRole } from "@auction/types";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import type {
  BulkLotsOutcome,
  ICatalogLotLifecycleHttpApplicationService,
} from "../interfaces/catalog-routes/catalog-lot-lifecycle-http.js";
import type { ILotLifecycleTransitionExecutor } from "../interfaces/catalog-routes/catalog-lot-lifecycle-transition-executor.js";
import {
  type CatalogRouteErr,
  type CatalogRouteNoContent,
  type CatalogRouteOutcome,
  catalogRouteFromResult,
} from "../interfaces/catalog-routes/catalog-route-http.js";
import type { PresentedLot } from "../interfaces/catalog-routes/catalog-sale-lot-membership-http.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { ILotSoftDeleteService } from "../interfaces/lot-soft-delete.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";

export class CatalogLotLifecycleHttpApplicationService
  implements ICatalogLotLifecycleHttpApplicationService
{
  constructor(
    private readonly lotService: ILotService,
    private readonly lotSoftDeleteService: ILotSoftDeleteService,
    private readonly lotLifecycleTransitionExecutor: ILotLifecycleTransitionExecutor,
    private readonly mediaUrlResolver: IMediaUrlResolver,
    private readonly mediaAssetEnricher: IMediaAssetEnricher,
  ) {}

  private async present(lot: PresentedLot): Promise<PresentedLot> {
    return presentLotImages(this.mediaUrlResolver, lot, this.mediaAssetEnricher);
  }

  async bulkLots(input: {
    userId: string;
    role: UserRole;
    staffRole: string | null | undefined;
    ids: string[];
    op: "soft_delete" | "publish" | "cancel";
    confirmationPhrase?: string;
    reason?: string;
  }): Promise<CatalogRouteOutcome<BulkLotsOutcome>> {
    const staff = normalizeUserStaffRole(input.staffRole);
    if (input.op === "soft_delete") {
      const result = await this.lotSoftDeleteService.bulkSoftDelete(
        input.userId,
        input.role,
        input.ids,
        input.confirmationPhrase ?? "",
        staff,
      );
      if (result.isErr()) return catalogRouteFromResult(result);
      return { kind: "ok", data: result.value };
    }
    const result = await this.lotService.bulkPublishOrCancel(
      input.userId,
      input.role,
      input.ids,
      input.op,
      staff,
      input.reason,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: result.value };
  }

  async publish(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    staffRole: string | null | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const staff = normalizeUserStaffRole(input.staffRole);
    const result = await this.lotService.publish(input.userId, input.role, input.lotId, staff);
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async requestWithdrawal(input: {
    sellerUserId: string;
    lotId: string;
  }): Promise<CatalogRouteOutcome<{ alreadyPending: boolean } & Record<string, unknown>>> {
    const result = await this.lotService.requestWithdrawal(input.sellerUserId, input.lotId);
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: result.value };
  }

  async cancel(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    staffRole: string | null | undefined;
    cancelReason: "admin_override" | "manual";
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const result = await this.lotLifecycleTransitionExecutor.cancelLot({
      userId: input.userId,
      role: input.role,
      lotId: input.lotId,
      staffRole: input.staffRole ?? null,
      cancelReason: input.cancelReason,
    });
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async softDelete(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    confirmationPhrase: string;
    staffRole: string | null;
  }): Promise<CatalogRouteNoContent | CatalogRouteErr> {
    const result = await this.lotSoftDeleteService.softDelete(
      input.userId,
      input.role,
      input.lotId,
      input.confirmationPhrase,
      input.staffRole,
    );
    if (result.isErr()) return { kind: "err", error: result.error };
    return { kind: "no_content" };
  }

  async update(input: {
    role: UserRole;
    lotId: string;
    body: Partial<CreateLotInput>;
    staffRole: string | null | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const staff = normalizeUserStaffRole(input.staffRole);
    const result = await this.lotService.update(input.role, input.lotId, input.body, staff);
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async updateMarketingDetails(input: {
    role: UserRole;
    lotId: string;
    body: Record<string, unknown>;
    staffRole: string | null | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const staff = normalizeUserStaffRole(input.staffRole);
    const result = await this.lotService.updateMarketingDetails(
      input.role,
      input.lotId,
      input.body as Parameters<ILotService["updateMarketingDetails"]>[2],
      staff,
    );
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value) };
  }

  async create(input: {
    userId: string;
    role: UserRole;
    staffRole: string | null | undefined;
    body: CreateLotInput;
  }): Promise<CatalogRouteOutcome<PresentedLot>> {
    const staff = normalizeUserStaffRole(input.staffRole);
    if (!canManageCatalogue(input.role, staff)) {
      const e = missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can create lots",
        input.role,
        staff,
      );
      return { kind: "err", error: e };
    }
    if (!input.body.sellerLegalEntityId) {
      return { kind: "err", error: new LotError("sellerLegalEntityId is required", 400) };
    }
    const result = await this.lotService.create(input.userId, input.body);
    if (result.isErr()) return catalogRouteFromResult(result);
    return { kind: "ok", data: await this.present(result.value), status: 201 };
  }
}
