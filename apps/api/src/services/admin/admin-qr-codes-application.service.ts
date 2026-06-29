import type { IAdminQrCodesApplicationService } from "../interfaces/admin-routes.js";
import type { QrCodeAnalyticsService } from "../qr-code-analytics.service.js";
import type { QrCodeService } from "../qr-code.service.js";

export class AdminQrCodesApplicationService implements IAdminQrCodesApplicationService {
  constructor(
    private readonly qrCodes: QrCodeService,
    private readonly analytics: QrCodeAnalyticsService,
  ) {}

  listForEntity(...args: Parameters<QrCodeService["listForEntity"]>) {
    return this.qrCodes.listForEntity(...args);
  }

  getOrCreateDefault(...args: Parameters<QrCodeService["getOrCreateDefault"]>) {
    return this.qrCodes.getOrCreateDefault(...args);
  }

  update(...args: Parameters<QrCodeService["update"]>) {
    return this.qrCodes.update(...args);
  }

  regenerateDefault(...args: Parameters<QrCodeService["regenerateDefault"]>) {
    return this.qrCodes.regenerateDefault(...args);
  }

  getDetailedAnalytics(...args: Parameters<QrCodeAnalyticsService["getDetailed"]>) {
    return this.analytics.getDetailed(...args);
  }
}
