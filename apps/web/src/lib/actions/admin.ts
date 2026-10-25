"use server";

import { adminCreateLotResultAction as _adminCreateLotResultAction } from "./admin/admin-lots";
export const adminCreateLotResultAction = _adminCreateLotResultAction;

import { adminUpdateLotMarketingDetailsResultAction as _adminUpdateLotMarketingDetailsResultAction } from "./admin/admin-lots";
export const adminUpdateLotMarketingDetailsResultAction =
  _adminUpdateLotMarketingDetailsResultAction;

import { adminGetLotAttachPreviewAction as _adminGetLotAttachPreviewAction } from "./admin/admin-lots";
export const adminGetLotAttachPreviewAction = _adminGetLotAttachPreviewAction;

import { adminUpdateLotResultAction as _adminUpdateLotResultAction } from "./admin/admin-lots";
export const adminUpdateLotResultAction = _adminUpdateLotResultAction;

import { adminPublishLotResultAction as _adminPublishLotResultAction } from "./admin/admin-lots";
export const adminPublishLotResultAction = _adminPublishLotResultAction;

import { adminCancelLotResultAction as _adminCancelLotResultAction } from "./admin/admin-lots";
export const adminCancelLotResultAction = _adminCancelLotResultAction;

import { adminSoftDeleteLotResultAction as _adminSoftDeleteLotResultAction } from "./admin/admin-lots";
export const adminSoftDeleteLotResultAction = _adminSoftDeleteLotResultAction;

import { adminReturnLotToInventoryResultAction as _adminReturnLotToInventoryResultAction } from "./admin/admin-lots";
export const adminReturnLotToInventoryResultAction = _adminReturnLotToInventoryResultAction;

import { adminApproveWithdrawalRequestResultAction as _adminApproveWithdrawalRequestResultAction } from "./admin/admin-lots";
export const adminApproveWithdrawalRequestResultAction = _adminApproveWithdrawalRequestResultAction;
import { adminDeclineWithdrawalRequestResultAction as _adminDeclineWithdrawalRequestResultAction } from "./admin/admin-lots";
export const adminDeclineWithdrawalRequestResultAction = _adminDeclineWithdrawalRequestResultAction;

import { adminBulkLotsResultAction as _adminBulkLotsResultAction } from "./admin/admin-lots";
export const adminBulkLotsResultAction = _adminBulkLotsResultAction;

import { adminCreateCategoryResultAction as _adminCreateCategoryResultAction } from "./admin/admin-catalog";
export const adminCreateCategoryResultAction = _adminCreateCategoryResultAction;

import { adminUpdateCategoryResultAction as _adminUpdateCategoryResultAction } from "./admin/admin-catalog";
export const adminUpdateCategoryResultAction = _adminUpdateCategoryResultAction;

import { adminArchiveCategoryResultAction as _adminArchiveCategoryResultAction } from "./admin/admin-catalog";
export const adminArchiveCategoryResultAction = _adminArchiveCategoryResultAction;

import { adminDeleteCategoryResultAction as _adminDeleteCategoryResultAction } from "./admin/admin-catalog";
export const adminDeleteCategoryResultAction = _adminDeleteCategoryResultAction;

import { adminCreateArtistResultAction as _adminCreateArtistResultAction } from "./admin/admin-catalog";
export const adminCreateArtistResultAction = _adminCreateArtistResultAction;

import { adminReviewArtistResultAction as _adminReviewArtistResultAction } from "./admin/admin-catalog";
export const adminReviewArtistResultAction = _adminReviewArtistResultAction;

import { adminMergeArtistResultAction as _adminMergeArtistResultAction } from "./admin/admin-catalog";
export const adminMergeArtistResultAction = _adminMergeArtistResultAction;

import { adminDeleteArtistResultAction as _adminDeleteArtistResultAction } from "./admin/admin-catalog";
export const adminDeleteArtistResultAction = _adminDeleteArtistResultAction;

import { adminUpdateArtistResultAction as _adminUpdateArtistResultAction } from "./admin/admin-catalog";
export const adminUpdateArtistResultAction = _adminUpdateArtistResultAction;

import { adminRefundPaymentAction as _adminRefundPaymentAction } from "./admin/admin-payments";
export const adminRefundPaymentAction = _adminRefundPaymentAction;

import { adminCapturePaymentAction as _adminCapturePaymentAction } from "./admin/admin-payments";
export const adminCapturePaymentAction = _adminCapturePaymentAction;

import { adminCapturePaymentResultAction as _adminCapturePaymentResultAction } from "./admin/admin-payments";
export const adminCapturePaymentResultAction = _adminCapturePaymentResultAction;

import { adminRefundPaymentResultAction as _adminRefundPaymentResultAction } from "./admin/admin-payments";
export const adminRefundPaymentResultAction = _adminRefundPaymentResultAction;

import { adminPaymentXeroSyncResultAction as _adminPaymentXeroSyncResultAction } from "./admin/admin-payments";
export const adminPaymentXeroSyncResultAction = _adminPaymentXeroSyncResultAction;

import { adminXeroOAuthStartAction as _adminXeroOAuthStartAction } from "./admin/admin-payments";
export const adminXeroOAuthStartAction = _adminXeroOAuthStartAction;

import { adminXeroDisconnectAction as _adminXeroDisconnectAction } from "./admin/admin-payments";
export const adminXeroDisconnectAction = _adminXeroDisconnectAction;

import { adminSuspendUserAction as _adminSuspendUserAction } from "./admin/admin-users";
export const adminSuspendUserAction = _adminSuspendUserAction;

import { adminUnsuspendUserAction as _adminUnsuspendUserAction } from "./admin/admin-users";
export const adminUnsuspendUserAction = _adminUnsuspendUserAction;

import { adminSetUserRoleAction as _adminSetUserRoleAction } from "./admin/admin-users";
export const adminSetUserRoleAction = _adminSetUserRoleAction;

import { adminBulkUsersResultAction as _adminBulkUsersResultAction } from "./admin/admin-users";
export const adminBulkUsersResultAction = _adminBulkUsersResultAction;

import { adminBulkSubmissionsResultAction as _adminBulkSubmissionsResultAction } from "./admin/admin-users";
export const adminBulkSubmissionsResultAction = _adminBulkSubmissionsResultAction;

import { adminSetUserStaffRoleResultAction as _adminSetUserStaffRoleResultAction } from "./admin/admin-users";
export const adminSetUserStaffRoleResultAction = _adminSetUserStaffRoleResultAction;

import { adminSetUserRoleResultAction as _adminSetUserRoleResultAction } from "./admin/admin-users";
export const adminSetUserRoleResultAction = _adminSetUserRoleResultAction;

import { adminSuspendUserResultAction as _adminSuspendUserResultAction } from "./admin/admin-users";
export const adminSuspendUserResultAction = _adminSuspendUserResultAction;

import { adminResetTwoFactorResultAction as _adminResetTwoFactorResultAction } from "./admin/admin-users";
export const adminResetTwoFactorResultAction = _adminResetTwoFactorResultAction;

import { adminUnsuspendUserResultAction as _adminUnsuspendUserResultAction } from "./admin/admin-users";
export const adminUnsuspendUserResultAction = _adminUnsuspendUserResultAction;

import { adminBulkInvitationsResultAction as _adminBulkInvitationsResultAction } from "./admin/admin-invitations";
export const adminBulkInvitationsResultAction = _adminBulkInvitationsResultAction;

import { adminCreateInvitationResultAction as _adminCreateInvitationResultAction } from "./admin/admin-invitations";
export const adminCreateInvitationResultAction = _adminCreateInvitationResultAction;

import { adminCreateInvitationAction as _adminCreateInvitationAction } from "./admin/admin-invitations";
export const adminCreateInvitationAction = _adminCreateInvitationAction;

import { adminRevokeInvitationAction as _adminRevokeInvitationAction } from "./admin/admin-invitations";
export const adminRevokeInvitationAction = _adminRevokeInvitationAction;

import { adminResendInvitationAction as _adminResendInvitationAction } from "./admin/admin-invitations";
export const adminResendInvitationAction = _adminResendInvitationAction;

import { adminDecideSaleRegistrationResultAction as _adminDecideSaleRegistrationResultAction } from "./admin/admin-sale-registrations";
export const adminDecideSaleRegistrationResultAction = _adminDecideSaleRegistrationResultAction;

import { adminTelephoneBookingResultAction as _adminTelephoneBookingResultAction } from "./admin/admin-telephone";
export const adminTelephoneBookingResultAction = _adminTelephoneBookingResultAction;

import {
  adminDeclineConditionReportResultAction as _adminDeclineConditionReportResultAction,
  adminFulfilConditionReportResultAction as _adminFulfilConditionReportResultAction,
  adminMarkConditionReportInProgressResultAction as _adminMarkConditionReportInProgressResultAction,
} from "./admin/admin-condition-reports";
export const adminMarkConditionReportInProgressResultAction =
  _adminMarkConditionReportInProgressResultAction;
export const adminFulfilConditionReportResultAction = _adminFulfilConditionReportResultAction;
export const adminDeclineConditionReportResultAction = _adminDeclineConditionReportResultAction;

import { adminLotFulfilmentReleaseResultAction as _adminLotFulfilmentReleaseResultAction } from "./admin/admin-lot-fulfilment";
export const adminLotFulfilmentReleaseResultAction = _adminLotFulfilmentReleaseResultAction;

import { adminLotFulfilmentShipResultAction as _adminLotFulfilmentShipResultAction } from "./admin/admin-lot-fulfilment";
export const adminLotFulfilmentShipResultAction = _adminLotFulfilmentShipResultAction;

import { adminLotFulfilmentReadyForCollectionResultAction as _adminLotFulfilmentReadyForCollectionResultAction } from "./admin/admin-lot-fulfilment";
export const adminLotFulfilmentReadyForCollectionResultAction =
  _adminLotFulfilmentReadyForCollectionResultAction;

import { adminLotFulfilmentDeliveredResultAction as _adminLotFulfilmentDeliveredResultAction } from "./admin/admin-lot-fulfilment";
export const adminLotFulfilmentDeliveredResultAction = _adminLotFulfilmentDeliveredResultAction;

import { adminLotFulfilmentCollectedResultAction as _adminLotFulfilmentCollectedResultAction } from "./admin/admin-lot-fulfilment";
export const adminLotFulfilmentCollectedResultAction = _adminLotFulfilmentCollectedResultAction;

import { adminSaleroomGoLiveAction as _adminSaleroomGoLiveAction } from "./admin/admin-saleroom";
export const adminSaleroomGoLiveAction = _adminSaleroomGoLiveAction;

import { adminSaleroomPauseAction as _adminSaleroomPauseAction } from "./admin/admin-saleroom";
export const adminSaleroomPauseAction = _adminSaleroomPauseAction;

import { adminSaleroomResumeAction as _adminSaleroomResumeAction } from "./admin/admin-saleroom";
export const adminSaleroomResumeAction = _adminSaleroomResumeAction;

import { adminSaleroomAdvanceAction as _adminSaleroomAdvanceAction } from "./admin/admin-saleroom";
export const adminSaleroomAdvanceAction = _adminSaleroomAdvanceAction;

import { adminSaleroomHammerAction as _adminSaleroomHammerAction } from "./admin/admin-saleroom";
export const adminSaleroomHammerAction = _adminSaleroomHammerAction;

import { adminSaleroomNoSaleAction as _adminSaleroomNoSaleAction } from "./admin/admin-saleroom";
export const adminSaleroomNoSaleAction = _adminSaleroomNoSaleAction;

import { adminSaleroomCloseAction as _adminSaleroomCloseAction } from "./admin/admin-saleroom";
export const adminSaleroomCloseAction = _adminSaleroomCloseAction;

import { adminSaleroomDisplayApproveAction as _adminSaleroomDisplayApproveAction } from "./admin/admin-saleroom";
export const adminSaleroomDisplayApproveAction = _adminSaleroomDisplayApproveAction;

import { adminSaleroomDisplayOverlayAction as _adminSaleroomDisplayOverlayAction } from "./admin/admin-saleroom";
export const adminSaleroomDisplayOverlayAction = _adminSaleroomDisplayOverlayAction;

import { adminSaleroomDisplayClearOverlayAction as _adminSaleroomDisplayClearOverlayAction } from "./admin/admin-saleroom";
export const adminSaleroomDisplayClearOverlayAction = _adminSaleroomDisplayClearOverlayAction;

import { adminSaleroomDisplayRevokeAction as _adminSaleroomDisplayRevokeAction } from "./admin/admin-saleroom";
export const adminSaleroomDisplayRevokeAction = _adminSaleroomDisplayRevokeAction;

import { adminTelephoneBookingStartLineAction as _adminTelephoneBookingStartLineAction } from "./admin/admin-telephone";
export const adminTelephoneBookingStartLineAction = _adminTelephoneBookingStartLineAction;

import { adminTelephoneBookingCompleteLineAction as _adminTelephoneBookingCompleteLineAction } from "./admin/admin-telephone";
export const adminTelephoneBookingCompleteLineAction = _adminTelephoneBookingCompleteLineAction;

import { adminTelephonePlaceBidResultAction as _adminTelephonePlaceBidResultAction } from "./admin/admin-telephone";
export const adminTelephonePlaceBidResultAction = _adminTelephonePlaceBidResultAction;

import { adminSaleroomCheckInCandidatesResultAction as _adminSaleroomCheckInCandidatesResultAction } from "./admin/admin-paddle";
export const adminSaleroomCheckInCandidatesResultAction =
  _adminSaleroomCheckInCandidatesResultAction;

import { adminSaleroomCheckInResultAction as _adminSaleroomCheckInResultAction } from "./admin/admin-paddle";
export const adminSaleroomCheckInResultAction = _adminSaleroomCheckInResultAction;

import { adminAssignPaddleResultAction as _adminAssignPaddleResultAction } from "./admin/admin-paddle";
export const adminAssignPaddleResultAction = _adminAssignPaddleResultAction;

import { adminClearPaddleResultAction as _adminClearPaddleResultAction } from "./admin/admin-paddle";
export const adminClearPaddleResultAction = _adminClearPaddleResultAction;

import { adminPaddlePlaceBidResultAction as _adminPaddlePlaceBidResultAction } from "./admin/admin-paddle";
export const adminPaddlePlaceBidResultAction = _adminPaddlePlaceBidResultAction;
