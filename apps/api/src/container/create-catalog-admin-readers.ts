import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import { AdminLotBrowseService } from "../services/admin/admin-lot-browse.service.js";
import { DashboardQueryService } from "../services/dashboard-query.service.js";
import { LotLifecycleQueryService } from "../services/lot-lifecycle-query.service.js";
import { NotificationQueryService } from "../services/notification-query.service.js";
import { QrCodeAnalyticsService } from "../services/qr-code-analytics.service.js";
import { QrCodeService } from "../services/qr-code.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerCatalogAdminReaders = {
  lotLifecycleQueryService: LotLifecycleQueryService;
  adminLotBrowseService: AdminLotBrowseService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
};

export type CreateCatalogAdminReadersInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
};

export function createCatalogAdminReaders(
  input: CreateCatalogAdminReadersInput,
): ContainerCatalogAdminReaders {
  const { env, db, infra, repos } = input;
  const { redis, qrCodeScanQueue } = infra;
  const { repoFactory, notificationReadRepo } = repos;

  const lotLifecycleQueryService = new LotLifecycleQueryService(db);
  const adminLotBrowseService = new AdminLotBrowseService(repos.adminLotBrowseReader);
  const qrCodeService = new QrCodeService(
    db,
    redis,
    env.WEB_ORIGIN,
    createBaseLogger(env).child({ component: "qr_code" }),
    qrCodeScanQueue,
  );
  const qrCodeAnalytics = new QrCodeAnalyticsService(db);
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);

  return {
    lotLifecycleQueryService,
    adminLotBrowseService,
    qrCodeService,
    qrCodeAnalytics,
    dashboardQueryService,
    notificationQueryService,
  };
}
