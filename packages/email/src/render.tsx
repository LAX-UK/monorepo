import { render } from "@react-email/render";
import type { ReactElement } from "react";
import TwoFactorDisabledEmail, {
  subject as twoFactorDisabledSubject,
} from "./templates/2fa-disabled.js";
import TwoFactorEnabledEmail, {
  subject as twoFactorEnabledSubject,
} from "./templates/2fa-enabled.js";
import AccountSuspendedEmail, {
  subject as accountSuspendedSubject,
} from "./templates/account-suspended.js";
import AdminImpersonationNoticeEmail, {
  subject as adminImpersonationNoticeSubject,
} from "./templates/admin-impersonation-notice.js";
import AmlComplianceReviewNoticeEmail, {
  subject as amlComplianceReviewNoticeSubject,
} from "./templates/aml-compliance-review-notice.js";
import BidOutbidEmail, { subject as bidOutbidSubject } from "./templates/bid-outbid.js";
import ChangeEmail, { subject as changeEmailSubject } from "./templates/change-email.js";
import DisputeClosedNoticeEmail, {
  subject as disputeClosedNoticeSubject,
} from "./templates/dispute-closed-notice.js";
import DisputeOpenedNoticeEmail, {
  subject as disputeOpenedNoticeSubject,
} from "./templates/dispute-opened-notice.js";
import InviteEmail, { subject as inviteSubject } from "./templates/invite.js";
import KycResubmissionRequiredEmail, {
  subject as kycResubmissionRequiredSubject,
} from "./templates/kyc-resubmission-required.js";
import LegalEntityArchivedNoticeEmail, {
  subject as legalEntityArchivedNoticeSubject,
} from "./templates/legal-entity-archived-notice.js";
import LotEndedSellerEmail, {
  subject as lotEndedSellerSubject,
} from "./templates/lot-ended-seller.js";
import LotVoidedAntiShillingAdminEmail, {
  subject as lotVoidedAntiShillingAdminSubject,
} from "./templates/lot-voided-anti-shilling-admin.js";
import LotVoidedNoticeEmail, {
  subject as lotVoidedNoticeSubject,
} from "./templates/lot-voided-notice.js";
import LotWonEmail, { subject as lotWonSubject } from "./templates/lot-won.js";
import NewDeviceLoginEmail, {
  subject as newDeviceLoginSubject,
} from "./templates/new-device-login.js";
import OAuthAccountResetAttemptEmail, {
  subject as oauthAccountResetAttemptSubject,
} from "./templates/oauth-account-reset-attempt.js";
import PasswordChangedElsewhereEmail, {
  subject as passwordChangedElsewhereSubject,
} from "./templates/password-changed-elsewhere.js";
import PasswordChangedSessionsNotRevokedEmail, {
  subject as passwordChangedSessionsNotRevokedSubject,
} from "./templates/password-changed-sessions-not-revoked.js";
import PasswordChanged, {
  subject as passwordChangedSubject,
} from "./templates/password-changed.js";
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
import ProxyCancelledNoticeEmail, {
  subject as proxyCancelledNoticeSubject,
} from "./templates/proxy-cancelled-notice.js";
import ResetPassword, { subject as resetPasswordSubject } from "./templates/reset-password.js";
import VerifyEmail, { subject as verifyEmailSubject } from "./templates/verify-email.js";
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
  invite: { subject: inviteSubject, component: (vars) => <InviteEmail {...vars} /> },
  "bid-outbid": { subject: bidOutbidSubject, component: (vars) => <BidOutbidEmail {...vars} /> },
  "lot-won": { subject: lotWonSubject, component: (vars) => <LotWonEmail {...vars} /> },
  "lot-ended-seller": {
    subject: lotEndedSellerSubject,
    component: (vars) => <LotEndedSellerEmail {...vars} />,
  },
  "payment-receipt": {
    subject: paymentReceiptSubject,
    component: (vars) => <PaymentReceiptEmail {...vars} />,
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
  "lot-voided-notice": {
    subject: lotVoidedNoticeSubject,
    component: (vars) => <LotVoidedNoticeEmail {...vars} />,
  },
  "payout-clawback-required-notice": {
    subject: payoutClawbackRequiredNoticeSubject,
    component: (vars) => <PayoutClawbackRequiredNoticeEmail {...vars} />,
  },
  "legal-entity-archived-notice": {
    subject: legalEntityArchivedNoticeSubject,
    component: (vars) => <LegalEntityArchivedNoticeEmail {...vars} />,
  },
  "lot-voided-anti-shilling-admin": {
    subject: lotVoidedAntiShillingAdminSubject,
    component: (vars) => <LotVoidedAntiShillingAdminEmail {...vars} />,
  },
  "kyc-resubmission-required": {
    subject: kycResubmissionRequiredSubject,
    component: (vars) => <KycResubmissionRequiredEmail {...vars} />,
  },
  "aml-compliance-review-notice": {
    subject: amlComplianceReviewNoticeSubject,
    component: (vars) => <AmlComplianceReviewNoticeEmail {...vars} />,
  },
};

export async function renderEmail<T extends TemplateName>(
  template: T,
  vars: TemplateVarsByName[T],
): Promise<RenderedEmail> {
  const entry = renderers[template] as TemplateRenderer<T>;
  const component = entry.component(vars);
  const html = await render(component);
  const text = await render(component, { plainText: true });
  const subject = typeof entry.subject === "function" ? entry.subject(vars) : entry.subject;
  return { subject, html, text };
}
