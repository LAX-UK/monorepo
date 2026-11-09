import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { EmailProductContext, emailProductFor } from "./email-product.js";
import TwoFactorDisabledEmail, {
  subject as twoFactorDisabledSubject,
} from "./templates/2fa-disabled.js";
import TwoFactorEnabledEmail, {
  subject as twoFactorEnabledSubject,
} from "./templates/2fa-enabled.js";
import TwoFactorResetBySupportEmail, {
  subject as twoFactorResetBySupportSubject,
} from "./templates/2fa-reset-by-support.js";
import AccessInviteEmail, { subject as accessInviteSubject } from "./templates/access-invite.js";
import AccountActivation, {
  subject as accountActivationSubject,
} from "./templates/account-activation.js";
import AccountDeletionCancelledEmail, {
  subject as accountDeletionCancelledSubject,
} from "./templates/account-deletion-cancelled.js";
import AccountDeletionCompletedEmail, {
  subject as accountDeletionCompletedSubject,
} from "./templates/account-deletion-completed.js";
import AccountDeletionHeldEmail, {
  subject as accountDeletionHeldSubject,
} from "./templates/account-deletion-held.js";
import AccountDeletionReminderEmail, {
  subject as accountDeletionReminderSubject,
} from "./templates/account-deletion-reminder.js";
import AccountDeletionRequestedEmail, {
  subject as accountDeletionRequestedSubject,
} from "./templates/account-deletion-requested.js";
import AccountSuspendedEmail, {
  subject as accountSuspendedSubject,
} from "./templates/account-suspended.js";
import AdminImpersonationNoticeEmail, {
  subject as adminImpersonationNoticeSubject,
} from "./templates/admin-impersonation-notice.js";
import AlertConfirmEmail, { subject as alertConfirmSubject } from "./templates/alert-confirm.js";
import AlertDigestEmail, { subject as alertDigestSubject } from "./templates/alert-digest.js";
import AmlComplianceReviewNoticeEmail, {
  subject as amlComplianceReviewNoticeSubject,
} from "./templates/aml-compliance-review-notice.js";
import ArtArtistApplicationDeclinedEmail, {
  subject as artArtistApplicationDeclinedSubject,
} from "./templates/art-artist-application-declined.js";
import ArtArtistApplicationMoreInfoEmail, {
  subject as artArtistApplicationMoreInfoSubject,
} from "./templates/art-artist-application-more-info.js";
import ArtArtistApplicationReceivedEmail, {
  subject as artArtistApplicationReceivedSubject,
} from "./templates/art-artist-application-received.js";
import ArtArtistApplicationWelcomeEmail, {
  subject as artArtistApplicationWelcomeSubject,
} from "./templates/art-artist-application-welcome.js";
import ArtEnquiryReceivedEmail, {
  subject as artEnquiryReceivedSubject,
} from "./templates/art-enquiry-received.js";
import ArtGeneralEnquiryAlertEmail, {
  subject as artGeneralEnquiryAlertSubject,
} from "./templates/art-general-enquiry-alert.js";
import BackupCodesRegeneratedEmail, {
  subject as backupCodesRegeneratedSubject,
} from "./templates/backup-codes-regenerated.js";
import BidEnquiryReceivedEmail, {
  subject as bidEnquiryReceivedSubject,
} from "./templates/bid-enquiry-received.js";
import BidOutbidEmail, { subject as bidOutbidSubject } from "./templates/bid-outbid.js";
import BiddingLimitChangedNoticeEmail, {
  subject as biddingLimitChangedNoticeSubject,
} from "./templates/bidding-limit-changed-notice.js";
import BuyerDefaultNoticeEmail, {
  subject as buyerDefaultNoticeSubject,
} from "./templates/buyer-default-notice.js";
import ChangeEmail, { subject as changeEmailSubject } from "./templates/change-email.js";
import CollectionBookedEmail, {
  subject as collectionBookedSubject,
} from "./templates/collection-booked.js";
import CollectionCancelledEmail, {
  subject as collectionCancelledSubject,
} from "./templates/collection-cancelled.js";
import CollectionChangedEmail, {
  subject as collectionChangedSubject,
} from "./templates/collection-changed.js";
import CollectionCollectedEmail, {
  subject as collectionCollectedSubject,
} from "./templates/collection-collected.js";
import CollectionCollectorNoticeEmail, {
  subject as collectionCollectorNoticeSubject,
} from "./templates/collection-collector-notice.js";
import CollectionMissedEmail, {
  subject as collectionMissedSubject,
} from "./templates/collection-missed.js";
import CollectionReminderEmail, {
  subject as collectionReminderSubject,
} from "./templates/collection-reminder.js";
import ConsignmentAgreementReminderEmail, {
  subject as consignmentAgreementReminderSubject,
} from "./templates/consignment-agreement-reminder.js";
import ConsignmentUpdateEmail, {
  subject as consignmentUpdateSubject,
} from "./templates/consignment-update.js";
import DataExportReadyEmail, {
  subject as dataExportReadySubject,
} from "./templates/data-export-ready.js";
import DataExportRequestedEmail, {
  subject as dataExportRequestedSubject,
} from "./templates/data-export-requested.js";
import DisputeClosedNoticeEmail, {
  subject as disputeClosedNoticeSubject,
} from "./templates/dispute-closed-notice.js";
import DisputeOpenedNoticeEmail, {
  subject as disputeOpenedNoticeSubject,
} from "./templates/dispute-opened-notice.js";
import EmailChangedEmail, { subject as emailChangedSubject } from "./templates/email-changed.js";
import InviteEmail, { subject as inviteSubject } from "./templates/invite.js";
import KycApprovedEmail, { subject as kycApprovedSubject } from "./templates/kyc-approved.js";
import KycDeclinedEmail, { subject as kycDeclinedSubject } from "./templates/kyc-declined.js";
import KycResubmissionRequiredEmail, {
  subject as kycResubmissionRequiredSubject,
} from "./templates/kyc-resubmission-required.js";
import KycRetentionHoldNoticeEmail, {
  subject as kycRetentionHoldNoticeSubject,
} from "./templates/kyc-retention-hold-notice.js";
import LegalEntityArchivedNoticeEmail, {
  subject as legalEntityArchivedNoticeSubject,
} from "./templates/legal-entity-archived-notice.js";
import {
  LegalEntityApprovedNoticeEmail,
  LegalEntityDocsRequestedNoticeEmail,
  LegalEntityRejectedNoticeEmail,
  LegalEntitySubmittedAdminNoticeEmail,
  legalEntityApprovedSubject,
  legalEntityDocsRequestedSubject,
  legalEntityRejectedSubject,
  legalEntitySubmittedAdminSubject,
} from "./templates/legal-entity-lifecycle-notices.js";
import LotEndedSellerEmail, {
  subject as lotEndedSellerSubject,
} from "./templates/lot-ended-seller.js";
import LotFulfilmentUpdateEmail, {
  subject as lotFulfilmentUpdateSubject,
} from "./templates/lot-fulfilment-update.js";
import LotVoidedAntiShillingAdminEmail, {
  subject as lotVoidedAntiShillingAdminSubject,
} from "./templates/lot-voided-anti-shilling-admin.js";
import LotVoidedNoticeEmail, {
  subject as lotVoidedNoticeSubject,
} from "./templates/lot-voided-notice.js";
import LotWithdrawalDeclinedNoticeEmail, {
  subject as lotWithdrawalDeclinedNoticeSubject,
} from "./templates/lot-withdrawal-declined-notice.js";
import LotWonEmail, { subject as lotWonSubject } from "./templates/lot-won.js";
import MarketingEnquiryAlertEmail, {
  subject as marketingEnquiryAlertSubject,
} from "./templates/marketing-enquiry-alert.js";
import NewDeviceLoginEmail, {
  subject as newDeviceLoginSubject,
} from "./templates/new-device-login.js";
import OAuthAccountResetAttemptEmail, {
  subject as oauthAccountResetAttemptSubject,
} from "./templates/oauth-account-reset-attempt.js";
import {
  OrganisationMembershipEndedNoticeEmail,
  membershipEndedSubject as organisationMembershipEndedSubject,
} from "./templates/organisation-membership-notices.js";
import {
  AccessRequestDecidedNoticeEmail,
  AccessRequestedNoticeEmail,
  TwoStepReminderNoticeEmail,
  accessRequestDecidedSubject,
  accessRequestedSubject,
  twoStepReminderSubject,
} from "./templates/organisation-team-notices.js";
import PasswordChangedElsewhereEmail, {
  subject as passwordChangedElsewhereSubject,
} from "./templates/password-changed-elsewhere.js";
import PasswordChangedSessionsNotRevokedEmail, {
  subject as passwordChangedSessionsNotRevokedSubject,
} from "./templates/password-changed-sessions-not-revoked.js";
import PasswordChanged, {
  subject as passwordChangedSubject,
} from "./templates/password-changed.js";
import PaymentFailedNoticeEmail, {
  subject as paymentFailedNoticeSubject,
} from "./templates/payment-failed-notice.js";
import PaymentInvoiceEmail, {
  subject as paymentInvoiceSubject,
} from "./templates/payment-invoice.js";
import PaymentManualReviewAdminNoticeEmail, {
  subject as paymentManualReviewAdminNoticeSubject,
} from "./templates/payment-manual-review-admin-notice.js";
import PaymentManualReviewBuyerNoticeEmail, {
  subject as paymentManualReviewBuyerNoticeSubject,
} from "./templates/payment-manual-review-buyer-notice.js";
import PaymentReceiptEmail, {
  subject as paymentReceiptSubject,
} from "./templates/payment-receipt.js";
import PaymentRefundNoticeEmail, {
  subject as paymentRefundNoticeSubject,
} from "./templates/payment-refund-notice.js";
import PaymentReminderEmail, {
  subject as paymentReminderSubject,
} from "./templates/payment-reminder.js";
import PaymentUnappliedMoneyAdminNoticeEmail, {
  subject as paymentUnappliedMoneyAdminNoticeSubject,
} from "./templates/payment-unapplied-money-admin-notice.js";
import PayoutBankChangedNoticeEmail, {
  subject as payoutBankChangedNoticeSubject,
} from "./templates/payout-bank-changed-notice.js";
import PayoutClawbackRequiredNoticeEmail, {
  subject as payoutClawbackRequiredNoticeSubject,
} from "./templates/payout-clawback-required-notice.js";
import PayoutInitiatedNoticeEmail, {
  subject as payoutInitiatedNoticeSubject,
} from "./templates/payout-initiated-notice.js";
import PayoutTransferBlockedNoticeEmail, {
  subject as payoutTransferBlockedNoticeSubject,
} from "./templates/payout-transfer-blocked-notice.js";
import PayoutTransferFailedNoticeEmail, {
  subject as payoutTransferFailedNoticeSubject,
} from "./templates/payout-transfer-failed-notice.js";
import PhoneRemovedEmail, { subject as phoneRemovedSubject } from "./templates/phone-removed.js";
import PhoneVerifiedEmail, { subject as phoneVerifiedSubject } from "./templates/phone-verified.js";
import ProxyCancelledNoticeEmail, {
  subject as proxyCancelledNoticeSubject,
} from "./templates/proxy-cancelled-notice.js";
import ResetPassword, { subject as resetPasswordSubject } from "./templates/reset-password.js";
import SaleCancelledNoticeEmail, {
  subject as saleCancelledNoticeSubject,
} from "./templates/sale-cancelled-notice.js";
import SaleRegistrationDecisionNoticeEmail, {
  subject as saleRegistrationDecisionNoticeSubject,
} from "./templates/sale-registration-decision-notice.js";
import ShopArtworkEnquiryAlertEmail, {
  subject as shopArtworkEnquiryAlertSubject,
} from "./templates/shop-artwork-enquiry-alert.js";
import ShopCancellationConfirmedEmail, {
  subject as shopCancellationConfirmedSubject,
} from "./templates/shop-cancellation-confirmed.js";
import ShopCheckoutOpsAlertEmail, {
  subject as shopCheckoutOpsAlertSubject,
} from "./templates/shop-checkout-ops-alert.js";
import ShopDeliveryQuoteDeclinedEmail, {
  subject as shopDeliveryQuoteDeclinedSubject,
} from "./templates/shop-delivery-quote-declined.js";
import ShopDeliveryQuoteReadyEmail, {
  subject as shopDeliveryQuoteReadySubject,
} from "./templates/shop-delivery-quote-ready.js";
import ShopDeliveryQuoteRequestedEmail, {
  subject as shopDeliveryQuoteRequestedSubject,
} from "./templates/shop-delivery-quote-requested.js";
import ShopDispatchNoticeEmail, {
  subject as shopDispatchNoticeSubject,
} from "./templates/shop-dispatch-notice.js";
import ShopEditionAvailableNotifyEmail, {
  subject as shopEditionAvailableNotifySubject,
} from "./templates/shop-edition-available-notify.js";
import ShopGuestOrderLinkEmail, {
  subject as shopGuestOrderLinkSubject,
} from "./templates/shop-guest-order-link.js";
import ShopOrderReceiptEmail, {
  subject as shopOrderReceiptSubject,
} from "./templates/shop-order-receipt.js";
import ShopPrintSwappedEmail, {
  subject as shopPrintSwappedSubject,
} from "./templates/shop-print-swapped.js";
import ShopProductionStartedEmail, {
  subject as shopProductionStartedSubject,
} from "./templates/shop-production-started.js";
import ShopRefundIssuedEmail, {
  subject as shopRefundIssuedSubject,
} from "./templates/shop-refund-issued.js";
import ShopReleaseAlertConfirmEmail, {
  subject as shopReleaseAlertConfirmSubject,
} from "./templates/shop-release-alert-confirm.js";
import ShopReleaseAlertEmail, {
  subject as shopReleaseAlertSubject,
} from "./templates/shop-release-alert.js";
import ShopReturnClosedSellerEmail, {
  subject as shopReturnClosedSellerSubject,
} from "./templates/shop-return-closed-seller.js";
import ShopZohoDeadLetterNoticeEmail, {
  subject as shopZohoDeadLetterNoticeSubject,
} from "./templates/shop-zoho-dead-letter-notice.js";
import SignInLink, { subject as signInLinkSubject } from "./templates/sign-in-link.js";
import SignInMethodAddedEmail, {
  subject as signInMethodAddedSubject,
} from "./templates/sign-in-method-added.js";
import SignInMethodRemovedEmail, {
  subject as signInMethodRemovedSubject,
} from "./templates/sign-in-method-removed.js";
import SourceOfFundsApprovedEmail, {
  subject as sourceOfFundsApprovedSubject,
} from "./templates/source-of-funds-approved.js";
import SourceOfFundsBuyerNoticeEmail, {
  subject as sourceOfFundsBuyerNoticeSubject,
} from "./templates/source-of-funds-buyer-notice.js";
import SourceOfFundsDocumentsRequestedEmail, {
  subject as sourceOfFundsDocumentsRequestedSubject,
} from "./templates/source-of-funds-documents-requested.js";
import SourceOfFundsRejectedEmail, {
  subject as sourceOfFundsRejectedSubject,
} from "./templates/source-of-funds-rejected.js";
import StaffEmailChangeCancelledNoticeEmail, {
  subject as staffEmailChangeCancelledNoticeSubject,
} from "./templates/staff-email-change-cancelled-notice.js";
import StaffEmailChangeConfirmEmail, {
  subject as staffEmailChangeConfirmSubject,
} from "./templates/staff-email-change-confirm.js";
import StaffEmailChangeNoticeEmail, {
  subject as staffEmailChangeNoticeSubject,
} from "./templates/staff-email-change-notice.js";
import StaffRoleChangedEmail, {
  subject as staffRoleChangedSubject,
} from "./templates/staff-role-changed.js";
import StaffRoleExpiredEmail, {
  subject as staffRoleExpiredSubject,
} from "./templates/staff-role-expired.js";
import SubmissionApprovedEmail, {
  subject as submissionApprovedSubject,
} from "./templates/submission-approved.js";
import SubmissionChangesRequestedEmail, {
  subject as submissionChangesRequestedSubject,
} from "./templates/submission-changes-requested.js";
import SubmissionConvertedEmail, {
  subject as submissionConvertedSubject,
} from "./templates/submission-converted.js";
import SubmissionDraftReminderEmail, {
  subject as submissionDraftReminderSubject,
} from "./templates/submission-draft-reminder.js";
import SubmissionRejectedEmail, {
  subject as submissionRejectedSubject,
} from "./templates/submission-rejected.js";
import UnconfirmedPasswordRemovedEmail, {
  subject as unconfirmedPasswordRemovedSubject,
} from "./templates/unconfirmed-password-removed.js";
import VerifyEmail, { subject as verifyEmailSubject } from "./templates/verify-email.js";
import WatchedLotReminderEmail, {
  subject as watchedLotReminderSubject,
} from "./templates/watched-lot-reminder.js";
import WelcomeEmail, { subject as welcomeSubject } from "./templates/welcome.js";
import type { RenderedEmail, TemplateName, TemplateVarsByName } from "./types.js";

type TemplateRenderer<T extends TemplateName> = {
  subject: string | ((vars: TemplateVarsByName[T]) => string);
  component: (vars: TemplateVarsByName[T]) => ReactElement;
};

const renderers: { [T in TemplateName]: TemplateRenderer<T> } = {
  "account-suspended": {
    subject: accountSuspendedSubject,
    component: (vars) => <AccountSuspendedEmail {...vars} />,
  },
  welcome: { subject: welcomeSubject, component: (vars) => <WelcomeEmail {...vars} /> },
  "verify-email": { subject: verifyEmailSubject, component: (vars) => <VerifyEmail {...vars} /> },
  "account-activation": {
    subject: accountActivationSubject,
    component: (vars) => <AccountActivation {...vars} />,
  },
  "sign-in-link": {
    subject: signInLinkSubject,
    component: (vars) => <SignInLink {...vars} />,
  },
  "reset-password": {
    subject: resetPasswordSubject,
    component: (vars) => <ResetPassword {...vars} />,
  },
  "oauth-account-reset-attempt": {
    subject: oauthAccountResetAttemptSubject,
    component: (vars) => <OAuthAccountResetAttemptEmail {...vars} />,
  },
  "password-changed": {
    subject: passwordChangedSubject,
    component: (vars) => <PasswordChanged {...vars} />,
  },
  "2fa-enabled": {
    subject: twoFactorEnabledSubject,
    component: (vars) => <TwoFactorEnabledEmail {...vars} />,
  },
  "2fa-disabled": {
    subject: twoFactorDisabledSubject,
    component: (vars) => <TwoFactorDisabledEmail {...vars} />,
  },
  "2fa-reset-by-support": {
    subject: twoFactorResetBySupportSubject,
    component: (vars) => <TwoFactorResetBySupportEmail {...vars} />,
  },
  "account-deletion-requested": {
    subject: accountDeletionRequestedSubject,
    component: (vars) => <AccountDeletionRequestedEmail {...vars} />,
  },
  "account-deletion-cancelled": {
    subject: accountDeletionCancelledSubject,
    component: (vars) => <AccountDeletionCancelledEmail {...vars} />,
  },
  "data-export-requested": {
    subject: dataExportRequestedSubject,
    component: (vars) => <DataExportRequestedEmail {...vars} />,
  },
  "data-export-ready": {
    subject: dataExportReadySubject,
    component: (vars) => <DataExportReadyEmail {...vars} />,
  },
  "account-deletion-reminder": {
    subject: accountDeletionReminderSubject,
    component: (vars) => <AccountDeletionReminderEmail {...vars} />,
  },
  "account-deletion-held": {
    subject: accountDeletionHeldSubject,
    component: (vars) => <AccountDeletionHeldEmail {...vars} />,
  },
  "account-deletion-completed": {
    subject: accountDeletionCompletedSubject,
    component: (vars) => <AccountDeletionCompletedEmail {...vars} />,
  },
  "backup-codes-regenerated": {
    subject: backupCodesRegeneratedSubject,
    component: (vars) => <BackupCodesRegeneratedEmail {...vars} />,
  },
  "email-changed": {
    subject: emailChangedSubject,
    component: (vars) => <EmailChangedEmail {...vars} />,
  },
  "sign-in-method-added": {
    subject: signInMethodAddedSubject,
    component: (vars) => <SignInMethodAddedEmail {...vars} />,
  },
  // Retired emails still in the queue render as the two above.
  "social-account-linked": {
    subject: signInMethodAddedSubject,
    component: ({ provider, userName }) => (
      <SignInMethodAddedEmail
        methodLabel={provider === "google" ? "Google" : "Apple"}
        whenDisplay=""
        secureAccountUrl=""
        userName={userName ?? null}
      />
    ),
  },
  "social-account-unlinked": {
    subject: signInMethodRemovedSubject,
    component: ({ provider, userName }) => (
      <SignInMethodRemovedEmail
        methodLabel={provider === "google" ? "Google" : "Apple"}
        whenDisplay=""
        secureAccountUrl=""
        userName={userName ?? null}
      />
    ),
  },
  "sign-in-method-removed": {
    subject: signInMethodRemovedSubject,
    component: (vars) => <SignInMethodRemovedEmail {...vars} />,
  },
  "unconfirmed-password-removed": {
    subject: unconfirmedPasswordRemovedSubject,
    component: (vars) => <UnconfirmedPasswordRemovedEmail {...vars} />,
  },
  "phone-removed": {
    subject: phoneRemovedSubject,
    component: (vars) => <PhoneRemovedEmail {...vars} />,
  },
  "phone-verified": {
    subject: phoneVerifiedSubject,
    component: (vars) => <PhoneVerifiedEmail {...vars} />,
  },
  "new-device-login": {
    subject: newDeviceLoginSubject,
    component: (vars) => <NewDeviceLoginEmail {...vars} />,
  },
  "password-changed-elsewhere": {
    subject: passwordChangedElsewhereSubject,
    component: (vars) => <PasswordChangedElsewhereEmail {...vars} />,
  },
  "password-changed-sessions-not-revoked": {
    subject: passwordChangedSessionsNotRevokedSubject,
    component: (vars) => <PasswordChangedSessionsNotRevokedEmail {...vars} />,
  },
  "change-email": {
    subject: changeEmailSubject,
    component: (vars) => <ChangeEmail {...vars} />,
  },
  "staff-email-change-confirm": {
    subject: staffEmailChangeConfirmSubject,
    component: (vars) => <StaffEmailChangeConfirmEmail {...vars} />,
  },
  "staff-email-change-notice": {
    subject: staffEmailChangeNoticeSubject,
    component: (vars) => <StaffEmailChangeNoticeEmail {...vars} />,
  },
  "staff-email-change-cancelled-notice": {
    subject: staffEmailChangeCancelledNoticeSubject,
    component: (vars) => <StaffEmailChangeCancelledNoticeEmail {...vars} />,
  },
  invite: { subject: inviteSubject, component: (vars) => <InviteEmail {...vars} /> },
  "access-invite": {
    subject: accessInviteSubject,
    component: (vars) => <AccessInviteEmail {...vars} />,
  },
  "bid-outbid": { subject: bidOutbidSubject, component: (vars) => <BidOutbidEmail {...vars} /> },
  "watched-lot-reminder": {
    subject: watchedLotReminderSubject,
    component: (vars) => <WatchedLotReminderEmail {...vars} />,
  },
  "collection-booked": {
    subject: collectionBookedSubject,
    component: (vars) => <CollectionBookedEmail {...vars} />,
  },
  "collection-changed": {
    subject: collectionChangedSubject,
    component: (vars) => <CollectionChangedEmail {...vars} />,
  },
  "collection-cancelled": {
    subject: collectionCancelledSubject,
    component: (vars) => <CollectionCancelledEmail {...vars} />,
  },
  "collection-reminder": {
    subject: collectionReminderSubject,
    component: (vars) => <CollectionReminderEmail {...vars} />,
  },
  "collection-collector-notice": {
    subject: collectionCollectorNoticeSubject,
    component: (vars) => <CollectionCollectorNoticeEmail {...vars} />,
  },
  "collection-collected": {
    subject: collectionCollectedSubject,
    component: (vars) => <CollectionCollectedEmail {...vars} />,
  },
  "collection-missed": {
    subject: collectionMissedSubject,
    component: (vars) => <CollectionMissedEmail {...vars} />,
  },
  "lot-fulfilment-update": {
    subject: lotFulfilmentUpdateSubject,
    component: (vars) => <LotFulfilmentUpdateEmail {...vars} />,
  },
  "lot-won": { subject: lotWonSubject, component: (vars) => <LotWonEmail {...vars} /> },
  "lot-ended-seller": {
    subject: lotEndedSellerSubject,
    component: (vars) => <LotEndedSellerEmail {...vars} />,
  },
  "payment-receipt": {
    subject: paymentReceiptSubject,
    component: (vars) => <PaymentReceiptEmail {...vars} />,
  },
  "payment-reminder": {
    subject: paymentReminderSubject,
    component: (vars) => <PaymentReminderEmail {...vars} />,
  },
  "buyer-default-notice": {
    subject: buyerDefaultNoticeSubject,
    component: (vars) => <BuyerDefaultNoticeEmail {...vars} />,
  },
  "payment-invoice": {
    subject: paymentInvoiceSubject,
    component: (vars) => <PaymentInvoiceEmail {...vars} />,
  },
  "admin-impersonation-notice": {
    subject: adminImpersonationNoticeSubject,
    component: (vars) => <AdminImpersonationNoticeEmail {...vars} />,
  },
  "payout-transfer-failed-notice": {
    subject: payoutTransferFailedNoticeSubject,
    component: (vars) => <PayoutTransferFailedNoticeEmail {...vars} />,
  },
  "payout-bank-changed-notice": {
    subject: payoutBankChangedNoticeSubject,
    component: (vars) => <PayoutBankChangedNoticeEmail {...vars} />,
  },
  "payout-transfer-blocked-notice": {
    subject: payoutTransferBlockedNoticeSubject,
    component: (vars) => <PayoutTransferBlockedNoticeEmail {...vars} />,
  },
  "payment-refund-notice": {
    subject: paymentRefundNoticeSubject,
    component: (vars) => <PaymentRefundNoticeEmail {...vars} />,
  },
  "payment-manual-review-buyer-notice": {
    subject: paymentManualReviewBuyerNoticeSubject,
    component: (vars) => <PaymentManualReviewBuyerNoticeEmail {...vars} />,
  },
  "payment-manual-review-admin-notice": {
    subject: paymentManualReviewAdminNoticeSubject,
    component: (vars) => <PaymentManualReviewAdminNoticeEmail {...vars} />,
  },
  "payment-unapplied-money-admin-notice": {
    subject: paymentUnappliedMoneyAdminNoticeSubject,
    component: (vars) => <PaymentUnappliedMoneyAdminNoticeEmail {...vars} />,
  },
  "payout-initiated-notice": {
    subject: payoutInitiatedNoticeSubject,
    component: (vars) => <PayoutInitiatedNoticeEmail {...vars} />,
  },
  "dispute-opened-notice": {
    subject: disputeOpenedNoticeSubject,
    component: (vars) => <DisputeOpenedNoticeEmail {...vars} />,
  },
  "dispute-closed-notice": {
    subject: disputeClosedNoticeSubject,
    component: (vars) => <DisputeClosedNoticeEmail {...vars} />,
  },
  "proxy-cancelled-notice": {
    subject: proxyCancelledNoticeSubject,
    component: (vars) => <ProxyCancelledNoticeEmail {...vars} />,
  },
  "sale-registration-decision-notice": {
    subject: saleRegistrationDecisionNoticeSubject,
    component: (vars) => <SaleRegistrationDecisionNoticeEmail {...vars} />,
  },
  "bidding-limit-changed-notice": {
    subject: biddingLimitChangedNoticeSubject,
    component: (vars) => <BiddingLimitChangedNoticeEmail {...vars} />,
  },
  "payment-failed-notice": {
    subject: paymentFailedNoticeSubject,
    component: (vars) => <PaymentFailedNoticeEmail {...vars} />,
  },
  "lot-voided-notice": {
    subject: lotVoidedNoticeSubject,
    component: (vars) => <LotVoidedNoticeEmail {...vars} />,
  },
  "lot-withdrawal-declined-notice": {
    subject: lotWithdrawalDeclinedNoticeSubject,
    component: (vars) => <LotWithdrawalDeclinedNoticeEmail {...vars} />,
  },
  "payout-clawback-required-notice": {
    subject: payoutClawbackRequiredNoticeSubject,
    component: (vars) => <PayoutClawbackRequiredNoticeEmail {...vars} />,
  },
  "legal-entity-archived-notice": {
    subject: legalEntityArchivedNoticeSubject,
    component: (vars) => <LegalEntityArchivedNoticeEmail {...vars} />,
  },
  "organisation-membership-ended-notice": {
    subject: organisationMembershipEndedSubject,
    component: (vars) => <OrganisationMembershipEndedNoticeEmail {...vars} />,
  },
  "access-requested-notice": {
    subject: accessRequestedSubject,
    component: (vars) => <AccessRequestedNoticeEmail {...vars} />,
  },
  "access-request-decided-notice": {
    subject: accessRequestDecidedSubject,
    component: (vars) => <AccessRequestDecidedNoticeEmail {...vars} />,
  },
  "two-step-reminder-notice": {
    subject: twoStepReminderSubject,
    component: (vars) => <TwoStepReminderNoticeEmail {...vars} />,
  },
  "legal-entity-submitted-admin-notice": {
    subject: legalEntitySubmittedAdminSubject,
    component: (vars) => <LegalEntitySubmittedAdminNoticeEmail {...vars} />,
  },
  "legal-entity-approved-notice": {
    subject: legalEntityApprovedSubject,
    component: (vars) => <LegalEntityApprovedNoticeEmail {...vars} />,
  },
  "legal-entity-rejected-notice": {
    subject: legalEntityRejectedSubject,
    component: (vars) => <LegalEntityRejectedNoticeEmail {...vars} />,
  },
  "legal-entity-docs-requested-notice": {
    subject: legalEntityDocsRequestedSubject,
    component: (vars) => <LegalEntityDocsRequestedNoticeEmail {...vars} />,
  },
  "lot-voided-anti-shilling-admin": {
    subject: lotVoidedAntiShillingAdminSubject,
    component: (vars) => <LotVoidedAntiShillingAdminEmail {...vars} />,
  },
  "kyc-resubmission-required": {
    subject: kycResubmissionRequiredSubject,
    component: (vars) => <KycResubmissionRequiredEmail {...vars} />,
  },
  "kyc-approved": {
    subject: kycApprovedSubject,
    component: (vars) => <KycApprovedEmail {...vars} />,
  },
  "kyc-declined": {
    subject: kycDeclinedSubject,
    component: (vars) => <KycDeclinedEmail {...vars} />,
  },
  "sale-cancelled-notice": {
    subject: saleCancelledNoticeSubject,
    component: (vars) => <SaleCancelledNoticeEmail {...vars} />,
  },
  "bid-enquiry-received": {
    subject: bidEnquiryReceivedSubject,
    component: (vars) => <BidEnquiryReceivedEmail {...vars} />,
  },
  "marketing-enquiry-alert": {
    subject: marketingEnquiryAlertSubject,
    component: (vars) => <MarketingEnquiryAlertEmail {...vars} />,
  },
  "staff-role-expired": {
    subject: staffRoleExpiredSubject,
    component: (vars) => <StaffRoleExpiredEmail {...vars} />,
  },
  "staff-role-changed": {
    subject: staffRoleChangedSubject,
    component: (vars) => <StaffRoleChangedEmail {...vars} />,
  },
  "aml-compliance-review-notice": {
    subject: amlComplianceReviewNoticeSubject,
    component: (vars) => <AmlComplianceReviewNoticeEmail {...vars} />,
  },
  "kyc-retention-hold-notice": {
    subject: kycRetentionHoldNoticeSubject,
    component: (vars) => <KycRetentionHoldNoticeEmail {...vars} />,
  },
  "submission-approved": {
    subject: submissionApprovedSubject,
    component: (vars) => <SubmissionApprovedEmail {...vars} />,
  },
  "submission-converted": {
    subject: submissionConvertedSubject,
    component: (vars) => <SubmissionConvertedEmail {...vars} />,
  },
  "submission-rejected": {
    subject: submissionRejectedSubject,
    component: (vars) => <SubmissionRejectedEmail {...vars} />,
  },
  "submission-draft-reminder": {
    subject: submissionDraftReminderSubject,
    component: (vars) => <SubmissionDraftReminderEmail {...vars} />,
  },
  "submission-changes-requested": {
    subject: submissionChangesRequestedSubject,
    component: (vars) => <SubmissionChangesRequestedEmail {...vars} />,
  },
  "consignment-agreement-reminder": {
    subject: consignmentAgreementReminderSubject,
    component: (vars) => <ConsignmentAgreementReminderEmail {...vars} />,
  },
  "consignment-update": {
    subject: consignmentUpdateSubject,
    component: (vars) => <ConsignmentUpdateEmail {...vars} />,
  },
  "source-of-funds-buyer-notice": {
    subject: sourceOfFundsBuyerNoticeSubject,
    component: (vars) => <SourceOfFundsBuyerNoticeEmail {...vars} />,
  },
  "source-of-funds-documents-requested": {
    subject: sourceOfFundsDocumentsRequestedSubject,
    component: (vars) => <SourceOfFundsDocumentsRequestedEmail {...vars} />,
  },
  "source-of-funds-approved": {
    subject: sourceOfFundsApprovedSubject,
    component: (vars) => <SourceOfFundsApprovedEmail {...vars} />,
  },
  "source-of-funds-rejected": {
    subject: sourceOfFundsRejectedSubject,
    component: (vars) => <SourceOfFundsRejectedEmail {...vars} />,
  },
  "shop-order-receipt": {
    subject: shopOrderReceiptSubject,
    component: (vars) => <ShopOrderReceiptEmail {...vars} />,
  },
  "alert-confirm": {
    subject: alertConfirmSubject,
    component: (vars) => <AlertConfirmEmail {...vars} />,
  },
  "alert-digest": {
    subject: alertDigestSubject,
    component: (vars) => <AlertDigestEmail {...vars} />,
  },
  "shop-guest-order-link": {
    subject: shopGuestOrderLinkSubject,
    component: (vars) => <ShopGuestOrderLinkEmail {...vars} />,
  },
  "shop-artwork-enquiry-alert": {
    subject: shopArtworkEnquiryAlertSubject,
    component: (vars) => <ShopArtworkEnquiryAlertEmail {...vars} />,
  },
  "art-artist-application-received": {
    subject: artArtistApplicationReceivedSubject,
    component: (vars) => <ArtArtistApplicationReceivedEmail {...vars} />,
  },
  "art-artist-application-more-info": {
    subject: artArtistApplicationMoreInfoSubject,
    component: (vars) => <ArtArtistApplicationMoreInfoEmail {...vars} />,
  },
  "art-artist-application-declined": {
    subject: artArtistApplicationDeclinedSubject,
    component: (vars) => <ArtArtistApplicationDeclinedEmail {...vars} />,
  },
  "art-artist-application-welcome": {
    subject: artArtistApplicationWelcomeSubject,
    component: (vars) => <ArtArtistApplicationWelcomeEmail {...vars} />,
  },
  "art-enquiry-received": {
    subject: artEnquiryReceivedSubject,
    component: (vars) => <ArtEnquiryReceivedEmail {...vars} />,
  },
  "art-general-enquiry-alert": {
    subject: artGeneralEnquiryAlertSubject,
    component: (vars) => <ArtGeneralEnquiryAlertEmail {...vars} />,
  },
  "shop-checkout-ops-alert": {
    subject: shopCheckoutOpsAlertSubject,
    component: (vars) => <ShopCheckoutOpsAlertEmail {...vars} />,
  },
  "shop-edition-available-notify": {
    subject: shopEditionAvailableNotifySubject,
    component: (vars) => <ShopEditionAvailableNotifyEmail {...vars} />,
  },
  "shop-release-alert-confirm": {
    subject: shopReleaseAlertConfirmSubject,
    component: (vars) => <ShopReleaseAlertConfirmEmail {...vars} />,
  },
  "shop-release-alert": {
    subject: shopReleaseAlertSubject,
    component: (vars) => <ShopReleaseAlertEmail {...vars} />,
  },
  "shop-zoho-dead-letter-notice": {
    subject: shopZohoDeadLetterNoticeSubject,
    component: (vars) => <ShopZohoDeadLetterNoticeEmail {...vars} />,
  },
  "shop-delivery-quote-ready": {
    subject: shopDeliveryQuoteReadySubject,
    component: (vars) => <ShopDeliveryQuoteReadyEmail {...vars} />,
  },
  "shop-delivery-quote-declined": {
    subject: shopDeliveryQuoteDeclinedSubject,
    component: (vars) => <ShopDeliveryQuoteDeclinedEmail {...vars} />,
  },
  "shop-delivery-quote-requested": {
    subject: shopDeliveryQuoteRequestedSubject,
    component: (vars) => <ShopDeliveryQuoteRequestedEmail {...vars} />,
  },
  "shop-production-started": {
    subject: shopProductionStartedSubject,
    component: (vars) => <ShopProductionStartedEmail {...vars} />,
  },
  "shop-print-swapped": {
    subject: shopPrintSwappedSubject,
    component: (vars) => <ShopPrintSwappedEmail {...vars} />,
  },
  "shop-dispatch-notice": {
    subject: shopDispatchNoticeSubject,
    component: (vars) => <ShopDispatchNoticeEmail {...vars} />,
  },
  "shop-refund-issued": {
    subject: shopRefundIssuedSubject,
    component: (vars) => <ShopRefundIssuedEmail {...vars} />,
  },
  "shop-cancellation-confirmed": {
    subject: shopCancellationConfirmedSubject,
    component: (vars) => <ShopCancellationConfirmedEmail {...vars} />,
  },
  "shop-return-closed-seller": {
    subject: shopReturnClosedSellerSubject,
    component: (vars) => <ShopReturnClosedSellerEmail {...vars} />,
  },
};

export async function renderEmail<T extends TemplateName>(
  template: T,
  vars: TemplateVarsByName[T],
): Promise<RenderedEmail> {
  const entry = renderers[template] as TemplateRenderer<T>;
  const component = (
    <EmailProductContext.Provider value={emailProductFor(template, vars)}>
      {entry.component(vars)}
    </EmailProductContext.Provider>
  );
  const html = await render(component);
  const text = await render(component, { plainText: true });
  const subject = typeof entry.subject === "function" ? entry.subject(vars) : entry.subject;
  return { subject, html, text };
}
