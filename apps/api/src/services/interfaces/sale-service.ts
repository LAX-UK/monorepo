import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import type { Result } from "neverthrow";
import type { LotAttachedToSalePayload } from "../../domain/lot-events.js";
import type { AuthzError, LotError } from "../../lib/errors.js";
import type { presentSaleAdminImages } from "../../lib/media-presenters.js";
import type { UpdateSaleBody } from "../sale/sale-update-draft.js";

export interface ISaleReadService {
  getById(id: string): Promise<Sale | null>;

  findByIds(ids: string[]): Promise<Sale[]>;

  getByIdWithLots(id: string): Promise<{ sale: Sale; lots: Lot[] } | null>;

  getSaleDetailForCatalogAdmin(saleId: string): Promise<{
    data: { sale: Awaited<ReturnType<typeof presentSaleAdminImages>>; lots: Lot[] };
  } | null>;

  getSaleDetailForPublicApi(
    saleId: string,
    viewerUserId: string | undefined,
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[]; viewer: { isFollowing: boolean } } } | null>;

  listSalesForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[] }[] }>;

  listSaleLotsPageForPublicApi(
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
  } | null>;

  listLotsPage(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
  ): Promise<{ items: Lot[]; total: number } | null>;

  list(filter: Parameters<ISaleRepository["list"]>[0]): Promise<{ sale: Sale; lots: Lot[] }[]>;
}

export interface ISaleWriteService {
  create(adminId: string, input: ValidatorCreateSale): Promise<Sale>;

  updateDraft(
    userRole: string,
    saleId: string,
    patch: UpdateSaleBody,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>>;
}

export interface ISaleLifecycleService {
  publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>>;

  unpublish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>>;

  cancel(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>>;
}

export interface ISaleLotMembershipService {
  addLot(
    userRole: string,
    saleId: string,
    row: CreateNestedLotForSaleInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>>;

  attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
    attachVia?: LotAttachedToSalePayload["via"],
  ): Promise<Result<Lot, LotError | AuthzError>>;

  detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>>;
}

export interface ISaleService
  extends ISaleReadService,
    ISaleWriteService,
    ISaleLifecycleService,
    ISaleLotMembershipService {}
