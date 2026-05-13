import "server-only";

import { type IAuthedApiClient, getAuthedApiClient } from "@/lib/services/http/authed-api-client";
import { AccountService } from "@/lib/services/impl/account.service";
import { AdminArtistService } from "@/lib/services/impl/admin-artist.service";
import { AdminCategoryService } from "@/lib/services/impl/admin-category.service";
import { AdminLotService } from "@/lib/services/impl/admin-lot.service";
import { AdminPaymentOpsService } from "@/lib/services/impl/admin-payment-ops.service";
import { AdminSaleService } from "@/lib/services/impl/admin-sale.service";
import { AdminSubmissionService } from "@/lib/services/impl/admin-submission.service";
import { AdminUserService } from "@/lib/services/impl/admin-user.service";
import { BiddingPrefsService } from "@/lib/services/impl/bidding-prefs.service";
import { NotificationPrefsService } from "@/lib/services/impl/notification-prefs.service";
import { PaymentService } from "@/lib/services/impl/payment.service";
import { ProfileService } from "@/lib/services/impl/profile.service";
import { SubmissionService } from "@/lib/services/impl/submission.service";
import { UiPrefsService } from "@/lib/services/impl/ui-prefs.service";
import type { IAccountService } from "@/lib/services/interfaces/account-service";
import type { IAdminArtistService } from "@/lib/services/interfaces/admin-artist-service";
import type { IAdminCategoryService } from "@/lib/services/interfaces/admin-category-service";
import type { IAdminLotService } from "@/lib/services/interfaces/admin-lot-service";
import type { IAdminPaymentOpsService } from "@/lib/services/interfaces/admin-payment-ops-service";
import type { IAdminSaleService } from "@/lib/services/interfaces/admin-sale-service";
import type { IAdminSubmissionService } from "@/lib/services/interfaces/admin-submission-service";
import type { IAdminUserService } from "@/lib/services/interfaces/admin-user-service";
import type { IBiddingPrefsService } from "@/lib/services/interfaces/bidding-prefs-service";
import type { INotificationPrefsService } from "@/lib/services/interfaces/notification-prefs-service";
import type { IPaymentService } from "@/lib/services/interfaces/payment-service";
import type { IProfileService } from "@/lib/services/interfaces/profile-service";
import type { ISubmissionService } from "@/lib/services/interfaces/submission-service";
import type { IUiPrefsService } from "@/lib/services/interfaces/ui-prefs-service";

export type WriteServiceContainer = {
  api: IAuthedApiClient;
  account: IAccountService;
  submissions: ISubmissionService;
  profile: IProfileService;
  biddingPrefs: IBiddingPrefsService;
  notificationPrefs: INotificationPrefsService;
  uiPrefs: IUiPrefsService;
  payments: IPaymentService;
  adminCategories: IAdminCategoryService;
  adminArtists: IAdminArtistService;
  adminLots: IAdminLotService;
  adminSales: IAdminSaleService;
  adminSubmissions: IAdminSubmissionService;
  adminUsers: IAdminUserService;
  adminPayments: IAdminPaymentOpsService;
};

let cached: WriteServiceContainer | null = null;

/** Server-only composition root for write paths (server actions + services).
 * Tests can inject a different container by not using this in unit tests, or we expand with factory later.
 */
export function getWriteContainer(): WriteServiceContainer {
  if (cached) return cached;
  const api = getAuthedApiClient();
  cached = {
    api,
    account: new AccountService(api),
    submissions: new SubmissionService(api),
    profile: new ProfileService(api),
    biddingPrefs: new BiddingPrefsService(api),
    notificationPrefs: new NotificationPrefsService(api),
    uiPrefs: new UiPrefsService(api),
    payments: new PaymentService(api),
    adminCategories: new AdminCategoryService(api),
    adminArtists: new AdminArtistService(api),
    adminLots: new AdminLotService(api),
    adminSales: new AdminSaleService(api),
    adminSubmissions: new AdminSubmissionService(api),
    adminUsers: new AdminUserService(api),
    adminPayments: new AdminPaymentOpsService(api),
  };
  return cached;
}

export function __resetWriteContainerForTests(): void {
  cached = null;
}
