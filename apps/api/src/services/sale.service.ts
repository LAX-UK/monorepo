import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { IVenueRepository } from "@auction/persistence";
import type { Lot, Sale } from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import type { Result } from "neverthrow";
import type { LotAttachedToSalePayload } from "../domain/lot-events.js";
import type { AuthzError, LotError } from "../lib/errors.js";
import type { presentSaleAdminImages } from "../lib/media-presenters.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../lib/platform-catalog-legal-entity.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { ISalePublishService } from "./interfaces/sale-publish.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { QrCodeService } from "./qr-code.service.js";
import { createSale } from "./sale/sale-create.js";
import {
  addLotToSale,
  attachExistingLotToSale,
  detachLotFromSale,
} from "./sale/sale-lot-membership.js";
import { SalePublishService } from "./sale/sale-publish.service.js";
import {
  findByIds,
  getById,
  getByIdWithLots,
  getSaleDetailForCatalogAdmin,
  getSaleDetailForPublicApi,
  list,
  listLotsPage,
  listSaleLotsPageForPublicApi,
  listSalesForPublicApi,
} from "./sale/sale-read.js";
import type { SaleFollowReader, SaleServiceDeps } from "./sale/sale-types.js";
import { type UpdateSaleBody, updateDraftSale } from "./sale/sale-update-draft.js";

export type { SaleFollowReader } from "./sale/sale-types.js";

export type SaleServiceOptions = {
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  jobScheduler: ILotJobScheduler | null;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  imageCleanup?: ImageCleanupService;
  saleFollowReader?: SaleFollowReader | null;
  mediaUrlResolver?: MediaUrlResolver;
  catalogueMediaUrlResolver?: MediaUrlResolver;
  mediaAssetEnricher?: MediaAssetEnricher;
  englishOnlyAuctions?: boolean;
  transactionRunner?: ITransactionRunner | null;
  domainEventSink?: IDomainEventSink | null;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  venueRepository?: IVenueRepository | null;
  enforceIndividualConnectOnPublish?: boolean;
  qrCodeService?: QrCodeService | null;
  repoFactory?: IRepositoryFactory | null;
  salePublishService?: ISalePublishService;
};

export class SaleService {
  private readonly deps: SaleServiceDeps;
  private readonly publishService: ISalePublishService;

  constructor(opts: SaleServiceOptions) {
    this.deps = {
      saleRepo: opts.saleRepo,
      lotRepo: opts.lotRepo,
      jobScheduler: opts.jobScheduler,
      resolvePlatformCatalogLegalEntityId: opts.resolvePlatformCatalogLegalEntityId,
      imageCleanup: opts.imageCleanup,
      saleFollowReader: opts.saleFollowReader ?? null,
      mediaUrlResolver: opts.mediaUrlResolver,
      catalogueMediaUrlResolver: opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver,
      mediaAssetEnricher: opts.mediaAssetEnricher,
      englishOnlyAuctions: opts.englishOnlyAuctions ?? false,
      transactionRunner: opts.transactionRunner ?? null,
      domainEventSink: opts.domainEventSink ?? null,
      lotLifecycleRecording: opts.lotLifecycleRecording ?? null,
      legalEntityRepository: opts.legalEntityRepository ?? null,
      venueRepository: opts.venueRepository ?? null,
      enforceIndividualConnectOnPublish: opts.enforceIndividualConnectOnPublish ?? false,
      qrCodeService: opts.qrCodeService ?? null,
      repoFactory: opts.repoFactory ?? null,
    };
    this.publishService = opts.salePublishService ?? new SalePublishService(this.deps);
  }

  async create(adminId: string, input: ValidatorCreateSale): Promise<Sale> {
    return createSale(this.deps, adminId, input);
  }

  async getByIdWithLots(id: string): Promise<{ sale: Sale; lots: Lot[] } | null> {
    return getByIdWithLots(this.deps, id);
  }

  async getSaleDetailForCatalogAdmin(saleId: string): Promise<{
    data: { sale: Awaited<ReturnType<typeof presentSaleAdminImages>>; lots: Lot[] };
  } | null> {
    return getSaleDetailForCatalogAdmin(this.deps, saleId);
  }

  async getSaleDetailForPublicApi(
    saleId: string,
    viewerUserId: string | undefined,
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[]; viewer: { isFollowing: boolean } } } | null> {
    return getSaleDetailForPublicApi(this.deps, saleId, viewerUserId, viewer);
  }

  async listSalesForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[] }[] }> {
    return listSalesForPublicApi(this.deps, filter, viewer);
  }

  async listSaleLotsPageForPublicApi(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{
    data: {
      items: Lot[];
      total: number;
      limit: number;
      offset: number;
      sort: typeof opts.sort;
    };
  } | null> {
    return listSaleLotsPageForPublicApi(this.deps, saleId, opts, viewer);
  }

  async listLotsPage(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
  ): Promise<{ items: Lot[]; total: number } | null> {
    return listLotsPage(this.deps, saleId, opts);
  }

  async list(
    filter: Parameters<ISaleRepository["list"]>[0],
  ): Promise<{ sale: Sale; lots: Lot[] }[]> {
    return list(this.deps, filter);
  }

  async publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    return this.publishService.publish(userId, userRole, saleId, userStaffRole);
  }

  async unpublish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    return this.publishService.unpublish(userId, userRole, saleId, userStaffRole);
  }

  async cancel(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    return this.publishService.cancel(userId, userRole, saleId, userStaffRole);
  }

  async addLot(
    userRole: string,
    saleId: string,
    row: CreateNestedLotForSaleInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return addLotToSale(this.deps, userRole, saleId, row, userStaffRole);
  }

  async attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
    attachVia: LotAttachedToSalePayload["via"] = "attach_endpoint",
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return attachExistingLotToSale(this.deps, userRole, saleId, lotId, userStaffRole, attachVia);
  }

  async detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>> {
    return detachLotFromSale(this.deps, userRole, saleId, lotId, userStaffRole);
  }

  async updateDraft(
    userRole: string,
    saleId: string,
    patch: UpdateSaleBody,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    return updateDraftSale(this.deps, userRole, saleId, patch, userStaffRole);
  }

  async getById(id: string): Promise<Sale | null> {
    return getById(this.deps, id);
  }

  async findByIds(ids: string[]): Promise<Sale[]> {
    return findByIds(this.deps, ids);
  }
}
