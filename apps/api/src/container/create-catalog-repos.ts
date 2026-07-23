import type { Database } from "@auction/db";
import type {
  IAbsenteeBidRepository,
  IAntiShillingGuard,
  IArtistDeleteGuards,
  IArtistDeleteRepository,
  IArtistProfileAdminReader,
  IArtistProfileCommandRepository,
  IArtistProfileDirectoryReader,
  IArtistRegistryRepository,
  IArtistWatchlistRepository,
  IAttentionFeedReader,
  ICategoryRepository,
  IConditionReportRequestRepository,
  IDisplayPairingRepository,
  IItemSubmissionRepository,
  ILotDocumentRepository,
  ILotLifecycleSnapshotReader,
  ILotLifecycleSnapshotRepository,
  ILotLifecycleTimelineReader,
  IMediaAssetReader,
  IOnsiteEventCheckInLogRepository,
  IOnsiteEventClientReader,
  IOnsiteEventRepository,
  IOnsiteEventRsvpRepository,
  IPaddleRepository,
  IPlatformCatalogLegalEntityReader,
  IQrCodeAnalyticsReader,
  IQrCodeRepository,
  IQrCodeScanPersister,
  IRepositoryFactory,
  ISaleAttentionSignalsReader,
  ISaleBiddersReader,
  ISaleDocumentRepository,
  ISaleExpectedGuestsReader,
  ISaleFollowRepository,
  ISaleModeLookup,
  ISaleOverviewKpiTrendReader,
  ISaleRegistrationRepository,
  ISaleRepository,
  ISaleRevenueSnapshotReader,
  ISaleroomCheckInRepository,
  ISaleroomDisplaySessionRepository,
  ISaleroomDisplaySnapshotReader,
  ISaleroomLiveSessionCounter,
  ISaleroomOnBlockReader,
  ISaleroomSessionLookup,
  ISubmissionDocumentRepository,
  ITelephoneBidBookingRepository,
  IUploadObjectReader,
  IUploadPersistenceRepository,
  IVenueRepository,
  IWatchlistRepository,
} from "@auction/persistence/interfaces";
import { DrizzleRepositoryFactory } from "@auction/persistence/repositories";
import {
  DrizzleAbsenteeBidRepository,
  DrizzleAntiShillingRepository,
  DrizzleArtistRegistryRepository,
  DrizzleArtistWatchlistRepository,
  DrizzleAttentionFeedReader,
  DrizzleCategoryRepository,
  DrizzleConditionReportRequestRepository,
  DrizzleDisplayPairingRepository,
  DrizzleLotDocumentRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleLotLifecycleTimelineReader,
  DrizzleMediaAssetReader,
  DrizzleOnsiteEventCheckInLogRepository,
  DrizzleOnsiteEventClientReader,
  DrizzleOnsiteEventRepository,
  DrizzleOnsiteEventRsvpRepository,
  DrizzlePaddleRepository,
  DrizzlePlatformCatalogLegalEntityReader,
  DrizzleQrCodeAnalyticsReader,
  DrizzleQrCodeRepository,
  DrizzleQrCodeScanPersister,
  DrizzleSaleAttentionSignalsReader,
  DrizzleSaleBiddersReader,
  DrizzleSaleDocumentRepository,
  DrizzleSaleExpectedGuestsReader,
  DrizzleSaleFollowRepository,
  DrizzleSaleModeLookup,
  DrizzleSaleOverviewKpiTrendReader,
  DrizzleSaleRegistrationRepository,
  DrizzleSaleRevenueSnapshotReader,
  DrizzleSaleroomCheckInRepository,
  DrizzleSaleroomDisplaySessionRepository,
  DrizzleSaleroomDisplaySnapshotReader,
  DrizzleSaleroomLiveSessionCounter,
  DrizzleSaleroomOnBlockReader,
  DrizzleSaleroomSessionLookup,
  DrizzleSubmissionDocumentRepository,
  DrizzleTelephoneBidBookingRepository,
  DrizzleUploadObjectReader,
  DrizzleUploadPersistenceRepository,
  DrizzleVenueRepository,
  DrizzleWatchlistRepository,
  createDrizzleArtistProfileRepository,
} from "@auction/persistence/repositories";

export type IArtistProfileRepository = IArtistProfileDirectoryReader &
  IArtistProfileAdminReader &
  IArtistProfileCommandRepository &
  IArtistDeleteGuards &
  IArtistDeleteRepository;

export type CatalogRepositories = {
  repoFactory: IRepositoryFactory;
  lotRepo: ReturnType<IRepositoryFactory["forConnection"]>["lot"];
  saleRepo: ISaleRepository;
  itemSubmissionRepository: IItemSubmissionRepository;
  saleRegistrationRepository: ISaleRegistrationRepository;
  conditionReportRequestRepository: IConditionReportRequestRepository;
  qrCodeRepository: IQrCodeRepository;
  categoryRepo: ICategoryRepository;
  venueRepo: IVenueRepository;
  watchlistRepo: IWatchlistRepository;
  artistWatchlistRepo: IArtistWatchlistRepository;
  antiShillingGuard: IAntiShillingGuard;
  saleroomSessionLookup: ISaleroomSessionLookup;
  lotLifecycleSnapshotRepository: ILotLifecycleSnapshotRepository;
  lotLifecycleSnapshotReader: ILotLifecycleSnapshotReader;
  lotLifecycleTimelineReader: ILotLifecycleTimelineReader;
  lotDocumentRepo: ILotDocumentRepository;
  saleDocumentRepo: ISaleDocumentRepository;
  submissionDocumentRepo: ISubmissionDocumentRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  uploadObjectReader: IUploadObjectReader;
  telephoneBidBookingRepo: ITelephoneBidBookingRepository;
  paddleRepo: IPaddleRepository;
  saleroomCheckInRepo: ISaleroomCheckInRepository;
  saleExpectedGuestsReader: ISaleExpectedGuestsReader;
  onsiteEventRepo: IOnsiteEventRepository;
  onsiteEventRsvpRepo: IOnsiteEventRsvpRepository;
  onsiteEventCheckInLogRepo: IOnsiteEventCheckInLogRepository;
  onsiteEventClientReader: IOnsiteEventClientReader;
  saleFollowRepo: ISaleFollowRepository;
  artistProfileRepo: IArtistProfileRepository;
  artistRegistryRepository: IArtistRegistryRepository;
  displayPairingRepository: IDisplayPairingRepository;
  saleModeLookup: ISaleModeLookup;
  attentionFeedReader: IAttentionFeedReader;
  saleAttentionSignalsReader: ISaleAttentionSignalsReader;
  saleOverviewKpiTrendReader: ISaleOverviewKpiTrendReader;
  saleRevenueSnapshotReader: ISaleRevenueSnapshotReader;
  saleroomDisplaySessionRepository: ISaleroomDisplaySessionRepository;
  saleBiddersReader: ISaleBiddersReader;
  saleroomDisplaySnapshotReader: ISaleroomDisplaySnapshotReader;
  qrCodeAnalyticsReader: IQrCodeAnalyticsReader;
  mediaAssetReader: IMediaAssetReader;
  qrCodeScanPersister: IQrCodeScanPersister;
  saleroomOnBlockReader: ISaleroomOnBlockReader;
  platformCatalogLegalEntityReader: IPlatformCatalogLegalEntityReader;
  saleroomLiveSessionCounter: ISaleroomLiveSessionCounter;
  absenteeBidRepository: IAbsenteeBidRepository;
};

export function createCatalogRepositories(db: Database): CatalogRepositories {
  const repoFactory: IRepositoryFactory = new DrizzleRepositoryFactory(db);
  const lotRepo = repoFactory.root.lot;
  const { sale: saleRepo, itemSubmission: itemSubmissionRepository } =
    repoFactory.forTransaction(db);
  const saleRegistrationRepository = new DrizzleSaleRegistrationRepository(db);
  const conditionReportRequestRepository = new DrizzleConditionReportRequestRepository(db);
  const qrCodeRepository = new DrizzleQrCodeRepository(db);
  const categoryRepo = new DrizzleCategoryRepository(db);
  const venueRepo = new DrizzleVenueRepository(db);
  const watchlistRepo = new DrizzleWatchlistRepository(db);
  const artistWatchlistRepo = new DrizzleArtistWatchlistRepository(db);
  const antiShillingGuard: IAntiShillingGuard = new DrizzleAntiShillingRepository(db);
  const saleroomSessionLookup = new DrizzleSaleroomSessionLookup(db);
  const lotLifecycleSnapshotRepository = new DrizzleLotLifecycleSnapshotRepository(db);
  const lotLifecycleSnapshotReader = lotLifecycleSnapshotRepository;
  const lotLifecycleTimelineReader = new DrizzleLotLifecycleTimelineReader(db);
  const lotDocumentRepo = new DrizzleLotDocumentRepository(db);
  const saleDocumentRepo = new DrizzleSaleDocumentRepository(db);
  const submissionDocumentRepo = new DrizzleSubmissionDocumentRepository(db);
  const uploadPersistenceRepository = new DrizzleUploadPersistenceRepository(db);
  const uploadObjectReader = new DrizzleUploadObjectReader(db);
  const telephoneBidBookingRepo = new DrizzleTelephoneBidBookingRepository(db);
  const paddleRepo = new DrizzlePaddleRepository(db);
  const saleroomCheckInRepo = new DrizzleSaleroomCheckInRepository(db);
  const saleExpectedGuestsReader = new DrizzleSaleExpectedGuestsReader(db);
  const onsiteEventRepo = new DrizzleOnsiteEventRepository(db);
  const onsiteEventRsvpRepo = new DrizzleOnsiteEventRsvpRepository(db);
  const onsiteEventCheckInLogRepo = new DrizzleOnsiteEventCheckInLogRepository(db);
  const onsiteEventClientReader = new DrizzleOnsiteEventClientReader(db);
  const saleFollowRepo = new DrizzleSaleFollowRepository(db);
  const artistProfileRepo = createDrizzleArtistProfileRepository(db);
  const artistRegistryRepository = new DrizzleArtistRegistryRepository(db);
  const displayPairingRepository = new DrizzleDisplayPairingRepository(db);
  const saleModeLookup = new DrizzleSaleModeLookup(db);
  const attentionFeedReader = new DrizzleAttentionFeedReader(db);
  const saleAttentionSignalsReader = new DrizzleSaleAttentionSignalsReader(db);
  const saleOverviewKpiTrendReader = new DrizzleSaleOverviewKpiTrendReader(db);
  const saleRevenueSnapshotReader = new DrizzleSaleRevenueSnapshotReader(db);
  const saleroomDisplaySessionRepository = new DrizzleSaleroomDisplaySessionRepository(db);
  const saleBiddersReader = new DrizzleSaleBiddersReader(db);
  const saleroomDisplaySnapshotReader = new DrizzleSaleroomDisplaySnapshotReader(db);
  const qrCodeAnalyticsReader = new DrizzleQrCodeAnalyticsReader(db);
  const mediaAssetReader = new DrizzleMediaAssetReader(db);
  const qrCodeScanPersister = new DrizzleQrCodeScanPersister(db);
  const saleroomOnBlockReader = new DrizzleSaleroomOnBlockReader(db);
  const platformCatalogLegalEntityReader = new DrizzlePlatformCatalogLegalEntityReader(db);
  const saleroomLiveSessionCounter = new DrizzleSaleroomLiveSessionCounter(db);
  const absenteeBidRepository = new DrizzleAbsenteeBidRepository(db);

  return {
    repoFactory,
    lotRepo,
    saleRepo,
    itemSubmissionRepository,
    saleRegistrationRepository,
    conditionReportRequestRepository,
    qrCodeRepository,
    categoryRepo,
    venueRepo,
    watchlistRepo,
    artistWatchlistRepo,
    antiShillingGuard,
    saleroomSessionLookup,
    lotLifecycleSnapshotRepository,
    lotLifecycleSnapshotReader,
    lotLifecycleTimelineReader,
    lotDocumentRepo,
    saleDocumentRepo,
    submissionDocumentRepo,
    uploadPersistenceRepository,
    uploadObjectReader,
    telephoneBidBookingRepo,
    paddleRepo,
    saleroomCheckInRepo,
    saleExpectedGuestsReader,
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    onsiteEventClientReader,
    saleFollowRepo,
    artistProfileRepo,
    artistRegistryRepository,
    displayPairingRepository,
    saleModeLookup,
    attentionFeedReader,
    saleAttentionSignalsReader,
    saleOverviewKpiTrendReader,
    saleRevenueSnapshotReader,
    saleroomDisplaySessionRepository,
    saleBiddersReader,
    saleroomDisplaySnapshotReader,
    qrCodeAnalyticsReader,
    mediaAssetReader,
    qrCodeScanPersister,
    saleroomOnBlockReader,
    platformCatalogLegalEntityReader,
    saleroomLiveSessionCounter,
    absenteeBidRepository,
  };
}
