import type { Database } from "@auction/db";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { vi } from "vitest";
import type { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import { CatalogLotReadHttpApplicationService } from "../services/catalog/catalog-lot-read-http-application.service.js";
import type { ICatalogLotReadHttpApplicationService } from "../services/interfaces/catalog-routes/catalog-lot-read-http.js";
import type { ILotService } from "../services/interfaces/lot-service.js";
import type { ILotSoftDeleteService } from "../services/interfaces/lot-soft-delete.js";
import type { IMediaAssetEnricher } from "../services/interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../services/interfaces/media-url-resolver.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type { ISaleService } from "../services/interfaces/sale-service.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { LotLifecycleQueryService } from "../services/lot-lifecycle-query.service.js";

export type CatalogLotReadHttpFixtureInput = {
  lotService: Partial<ILotService> & Pick<ILotService, "listLotsForPublicApi" | "getById">;
  saleService?: Partial<ISaleService>;
  lotSoftDeleteService?: Partial<ILotSoftDeleteService>;
  lotLifecycleQueryService?: Partial<LotLifecycleQueryService>;
  cachedCatalogueListService: CachedCatalogueListService;
  stripeConnectService?: Partial<IStripeConnectService>;
  legalEntityRepository?: Partial<ILegalEntityRepository>;
  mediaUrlResolver?: IMediaUrlResolver;
  mediaAssetEnricher?: IMediaAssetEnricher;
  db?: Database;
  objectStorage?: IObjectStorage;
};

const defaultMediaUrlResolver: IMediaUrlResolver = {
  resolve: vi.fn(async (url: string | null | undefined) => url ?? null),
  resolveMany: vi.fn(async (urls: readonly string[]) => [...urls]),
  resolveManyUnique: vi.fn(async (urls: readonly string[]) => new Map(urls.map((u) => [u, u]))),
};

export function createCatalogLotReadHttpFixture(
  input: CatalogLotReadHttpFixtureInput,
): ICatalogLotReadHttpApplicationService {
  return new CatalogLotReadHttpApplicationService(
    input.lotService as ILotService,
    (input.saleService ?? { getById: vi.fn(), findByIds: vi.fn() }) as ISaleService,
    (input.lotSoftDeleteService ?? {
      getDeleteEligibility: vi.fn(),
      getDeleteEligibilityBatch: vi.fn(),
    }) as ILotSoftDeleteService,
    (input.lotLifecycleQueryService ?? {
      getSnapshotsForLots: vi.fn().mockResolvedValue(new Map()),
    }) as LotLifecycleQueryService,
    input.cachedCatalogueListService,
    (input.stripeConnectService ?? { isConfigured: () => false }) as IStripeConnectService,
    (input.legalEntityRepository ?? {}) as ILegalEntityRepository,
    input.mediaUrlResolver ?? defaultMediaUrlResolver,
    (input.mediaAssetEnricher ?? {
      lookupByKeys: vi.fn(async () => new Map()),
      buildGalleryImages: vi.fn(async () => undefined),
      buildGalleryImagesWithLookup: vi.fn(() => undefined),
    }) as IMediaAssetEnricher,
    (input.db ?? {}) as Database,
    (input.objectStorage ?? { getPublicUrl: vi.fn((k: string) => k) }) as IObjectStorage,
  );
}
