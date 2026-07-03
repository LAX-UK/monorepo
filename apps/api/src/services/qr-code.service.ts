import { persistQrCodeScan, truncateIp } from "@auction/db";
import type { Database } from "@auction/db";
import { DrizzleQrCodeRepository } from "@auction/persistence";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { AppLogger } from "../lib/logger.js";
import type { IQrCodeRepository } from "../repositories/interfaces/qr-code.repository.js";
import type {
  IQrCodeAdminService,
  IQrCodePublicResolveService,
  IQrCodeService,
} from "./interfaces/qr-code-service.js";
import { QrCodeAdminCommandService } from "./qr-code/qr-code-admin-command.service.js";
import { decodeQrSequence, encodeQrSequence } from "./qr-code/qr-code-encoding.js";
import { QrCodePublicResolveService } from "./qr-code/qr-code-public-resolve.service.js";

export type {
  QrCodeDto,
  QrCodeEntityType,
  QrCodeResolveResult,
  QrCodeStatus,
} from "./qr-code/qr-code-types.js";
export { decodeQrSequence, encodeQrSequence };
export { persistQrCodeScan, truncateIp };

export class QrCodeService implements IQrCodeService {
  private readonly admin: IQrCodeAdminService;
  private readonly publicResolve: IQrCodePublicResolveService;

  constructor(
    db: Database,
    redis: Redis,
    webOrigin: string,
    logger?: AppLogger,
    scanQueue?: Queue,
    repo?: IQrCodeRepository,
  ) {
    const qrRepo = repo ?? new DrizzleQrCodeRepository(db);
    this.admin = new QrCodeAdminCommandService(qrRepo, redis, webOrigin);
    this.publicResolve = new QrCodePublicResolveService(
      qrRepo,
      redis,
      webOrigin,
      db,
      logger,
      scanQueue,
    );
  }

  getOrCreateDefault(
    ...args: Parameters<IQrCodeAdminService["getOrCreateDefault"]>
  ): ReturnType<IQrCodeAdminService["getOrCreateDefault"]> {
    return this.admin.getOrCreateDefault(...args);
  }

  listForEntity(
    ...args: Parameters<IQrCodeAdminService["listForEntity"]>
  ): ReturnType<IQrCodeAdminService["listForEntity"]> {
    return this.admin.listForEntity(...args);
  }

  update(
    ...args: Parameters<IQrCodeAdminService["update"]>
  ): ReturnType<IQrCodeAdminService["update"]> {
    return this.admin.update(...args);
  }

  regenerateDefault(
    ...args: Parameters<IQrCodeAdminService["regenerateDefault"]>
  ): ReturnType<IQrCodeAdminService["regenerateDefault"]> {
    return this.admin.regenerateDefault(...args);
  }

  resolve(
    ...args: Parameters<IQrCodePublicResolveService["resolve"]>
  ): ReturnType<IQrCodePublicResolveService["resolve"]> {
    return this.publicResolve.resolve(...args);
  }

  enqueueScan(
    ...args: Parameters<IQrCodePublicResolveService["enqueueScan"]>
  ): ReturnType<IQrCodePublicResolveService["enqueueScan"]> {
    return this.publicResolve.enqueueScan(...args);
  }
}

export type { IQrCodeAdminService, IQrCodePublicResolveService, IQrCodeService };
