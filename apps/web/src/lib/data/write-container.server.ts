import "server-only";

import { type IAuthedApiClient, getAuthedApiClient } from "@/lib/services/http/authed-api-client";
import { AccountService } from "@/lib/services/impl/account.service";
import { AdminArtistService } from "@/lib/services/impl/admin-artist.service";
import { AdminCategoryService } from "@/lib/services/impl/admin-category.service";
import { AdminComplianceService } from "@/lib/services/impl/admin-compliance.service";
import { AdminConditionReportsService } from "@/lib/services/impl/admin-condition-reports.service";
import { AdminDocumentsService } from "@/lib/services/impl/admin-documents.service";
import { AdminInvitationService } from "@/lib/services/impl/admin-invitation.service";
import { AdminLotFulfilmentService } from "@/lib/services/impl/admin-lot-fulfilment.service";
import { AdminLotService } from "@/lib/services/impl/admin-lot.service";
import { AdminPaddleService } from "@/lib/services/impl/admin-paddle.service";
import { AdminPaymentOpsService } from "@/lib/services/impl/admin-payment-ops.service";
import { AdminQrCodesService } from "@/lib/services/impl/admin-qr-codes.service";
import { AdminSaleRegistrationsService } from "@/lib/services/impl/admin-sale-registrations.service";
import { AdminSaleService } from "@/lib/services/impl/admin-sale.service";
import { AdminSaleroomService } from "@/lib/services/impl/admin-saleroom.service";
import { AdminStripeConnectService } from "@/lib/services/impl/admin-stripe-connect.service";
import { AdminSubmissionService } from "@/lib/services/impl/admin-submission.service";
import { AdminTelephoneService } from "@/lib/services/impl/admin-telephone.service";
import { AdminUserService } from "@/lib/services/impl/admin-user.service";
import { AdminVenueService } from "@/lib/services/impl/admin-venue.service";
import { BiddingPrefsService } from "@/lib/services/impl/bidding-prefs.service";
import { BuyerSofService } from "@/lib/services/impl/buyer-sof.service";
import { NotificationPrefsService } from "@/lib/services/impl/notification-prefs.service";
import { PaymentService } from "@/lib/services/impl/payment.service";
import { ProfileService } from "@/lib/services/impl/profile.service";
import { SubmissionService } from "@/lib/services/impl/submission.service";
import { UiPrefsService } from "@/lib/services/impl/ui-prefs.service";
import type { IAccountService } from "@/lib/services/interfaces/account-service";
import type { IAdminArtistService } from "@/lib/services/interfaces/admin-artist-service";
import type { IAdminCategoryService } from "@/lib/services/interfaces/admin-category-service";
import type { IAdminComplianceService } from "@/lib/services/interfaces/admin-compliance-service";
import type { IAdminConditionReportsService } from "@/lib/services/interfaces/admin-condition-reports-service";
import type { IAdminDocumentsService } from "@/lib/services/interfaces/admin-documents-service";
import type { IAdminInvitationService } from "@/lib/services/interfaces/admin-invitation-service";
import type { IAdminLotFulfilmentService } from "@/lib/services/interfaces/admin-lot-fulfilment-service";
import type { IAdminLotService } from "@/lib/services/interfaces/admin-lot-service";
import type { IAdminPaddleService } from "@/lib/services/interfaces/admin-paddle-service";
import type { IAdminPaymentOpsService } from "@/lib/services/interfaces/admin-payment-ops-service";
import type { IAdminQrCodesService } from "@/lib/services/interfaces/admin-qr-codes-service";
import type { IAdminSaleRegistrationsService } from "@/lib/services/interfaces/admin-sale-registrations-service";
import type { IAdminSaleService } from "@/lib/services/interfaces/admin-sale-service";
import type { IAdminSaleroomService } from "@/lib/services/interfaces/admin-saleroom-service";
import type { IAdminStripeConnectService } from "@/lib/services/interfaces/admin-stripe-connect-service";
import type { IAdminSubmissionService } from "@/lib/services/interfaces/admin-submission-service";
import type { IAdminTelephoneService } from "@/lib/services/interfaces/admin-telephone-service";
import type { IAdminUserService } from "@/lib/services/interfaces/admin-user-service";
import type { IAdminVenueService } from "@/lib/services/interfaces/admin-venue-service";
import type { IBiddingPrefsService } from "@/lib/services/interfaces/bidding-prefs-service";
import type { IBuyerSofService } from "@/lib/services/interfaces/buyer-sof-service";
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
  buyerSof: IBuyerSofService;
  adminCategories: IAdminCategoryService;
  adminSaleroom: IAdminSaleroomService;
  adminCompliance: IAdminComplianceService;
  adminLotFulfilment: IAdminLotFulfilmentService;
  adminPaddle: IAdminPaddleService;
  adminDocuments: IAdminDocumentsService;
  adminTelephone: IAdminTelephoneService;
  adminConditionReports: IAdminConditionReportsService;
  adminSaleRegistrations: IAdminSaleRegistrationsService;
  adminQrCodes: IAdminQrCodesService;
  adminStripeConnect: IAdminStripeConnectService;
  adminArtists: IAdminArtistService;
  adminLots: IAdminLotService;
  adminSales: IAdminSaleService;
  adminVenues: IAdminVenueService;
  adminSubmissions: IAdminSubmissionService;
  adminUsers: IAdminUserService;
  adminPayments: IAdminPaymentOpsService;
  invitations: IAdminInvitationService;
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
    buyerSof: new BuyerSofService(api),
    adminCategories: new AdminCategoryService(api),
    adminSaleroom: new AdminSaleroomService(api),
    adminCompliance: new AdminComplianceService(api),
    adminLotFulfilment: new AdminLotFulfilmentService(api),
    adminPaddle: new AdminPaddleService(api),
    adminDocuments: new AdminDocumentsService(api),
    adminTelephone: new AdminTelephoneService(api),
    adminConditionReports: new AdminConditionReportsService(api),
    adminSaleRegistrations: new AdminSaleRegistrationsService(api),
    adminQrCodes: new AdminQrCodesService(api),
    adminStripeConnect: new AdminStripeConnectService(api),
    adminArtists: new AdminArtistService(api),
    adminLots: new AdminLotService(api),
    adminSales: new AdminSaleService(api),
    adminVenues: new AdminVenueService(api),
    adminSubmissions: new AdminSubmissionService(api),
    adminUsers: new AdminUserService(api),
    adminPayments: new AdminPaymentOpsService(api),
    invitations: new AdminInvitationService(api),
  };
  return cached;
}

export function __resetWriteContainerForTests(): void {
  cached = null;
}
