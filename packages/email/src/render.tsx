import { render } from "@react-email/render";
import type { ReactElement } from "react";
import AdminImpersonationNoticeEmail, {
  subject as adminImpersonationNoticeSubject,
} from "./templates/admin-impersonation-notice.js";
import BidOutbidEmail, { subject as bidOutbidSubject } from "./templates/bid-outbid.js";
import PaymentRefundNoticeEmail, {
  subject as paymentRefundNoticeSubject,
} from "./templates/payment-refund-notice.js";
import PaymentManualReviewAdminNoticeEmail, {
  subject as paymentManualReviewAdminNoticeSubject,
} from "./templates/payment-manual-review-admin-notice.js";
import PaymentManualReviewBuyerNoticeEmail, {
  subject as paymentManualReviewBuyerNoticeSubject,
} from "./templates/payment-manual-review-buyer-notice.js";
import LegalEntityArchivedNoticeEmail, {
  subject as legalEntityArchivedNoticeSubject,
} from "./templates/legal-entity-archived-notice.js";
import LotVoidedAntiShillingAdminEmail, {
  subject as lotVoidedAntiShillingAdminSubject,
} from "./templates/lot-voided-anti-shilling-admin.js";
import PayoutTransferFailedNoticeEmail, {
  subject as payoutTransferFailedNoticeSubject,
} from "./templates/payout-transfer-failed-notice.js";
import PayoutTransferBlockedNoticeEmail, {
  subject as payoutTransferBlockedNoticeSubject,
} from "./templates/payout-transfer-blocked-notice.js";
import ChangeEmail, { subject as changeEmailSubject } from "./templates/change-email.js";
import InviteEmail, { subject as inviteSubject } from "./templates/invite.js";
import InvoiceIssuedEmail, { subject as invoiceIssuedSubject } from "./templates/invoice-issued.js";
import LotEndedSellerEmail, {
  subject as lotEndedSellerSubject,
} from "./templates/lot-ended-seller.js";
import LotWonEmail, { subject as lotWonSubject } from "./templates/lot-won.js";
import PasswordChanged, {
  subject as passwordChangedSubject,
} from "./templates/password-changed.js";
import PaymentInvoiceEmail, {
  subject as paymentInvoiceSubject,
} from "./templates/payment-invoice.js";
import PaymentReceiptEmail, {
  subject as paymentReceiptSubject,
} from "./templates/payment-receipt.js";
import ResetPassword, { subject as resetPasswordSubject } from "./templates/reset-password.js";
import VerifyEmail, { subject as verifyEmailSubject } from "./templates/verify-email.js";
import WelcomeEmail, { subject as welcomeSubject } from "./templates/welcome.js";
import type { RenderedEmail, TemplateName, TemplateVarsByName } from "./types.js";

type TemplateRenderer<T extends TemplateName> = {
  subject: string | ((vars: TemplateVarsByName[T]) => string);
  component: (vars: TemplateVarsByName[T]) => ReactElement;
};

const renderers: { [T in TemplateName]: TemplateRenderer<T> } = {
  welcome: { subject: welcomeSubject, component: (vars) => <WelcomeEmail {...vars} /> },
  "verify-email": { subject: verifyEmailSubject, component: (vars) => <VerifyEmail {...vars} /> },
  "reset-password": {
    subject: resetPasswordSubject,
    component: (vars) => <ResetPassword {...vars} />,
  },
  "password-changed": {
    subject: passwordChangedSubject,
    component: (vars) => <PasswordChanged {...vars} />,
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
  "invoice-issued": {
    subject: invoiceIssuedSubject,
    component: (vars) => <InvoiceIssuedEmail {...vars} />,
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
  "legal-entity-archived-notice": {
    subject: legalEntityArchivedNoticeSubject,
    component: (vars) => <LegalEntityArchivedNoticeEmail {...vars} />,
  },
  "lot-voided-anti-shilling-admin": {
    subject: lotVoidedAntiShillingAdminSubject,
    component: (vars) => <LotVoidedAntiShillingAdminEmail {...vars} />,
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
