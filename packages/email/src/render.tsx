import { render } from "@react-email/render";
import type { ReactElement } from "react";
import BidOutbidEmail, { subject as bidOutbidSubject } from "./templates/bid-outbid.js";
import ChangeEmail, { subject as changeEmailSubject } from "./templates/change-email.js";
import InviteEmail, { subject as inviteSubject } from "./templates/invite.js";
import InvoiceIssuedEmail, { subject as invoiceIssuedSubject } from "./templates/invoice-issued.js";
import LotEndedSellerEmail, {
  subject as lotEndedSellerSubject,
} from "./templates/lot-ended-seller.js";
import LotWonEmail, { subject as lotWonSubject } from "./templates/lot-won.js";
import PasswordChanged, { subject as passwordChangedSubject } from "./templates/password-changed.js";
import PaymentReceiptEmail, {
  subject as paymentReceiptSubject,
} from "./templates/payment-receipt.js";
import ResetPassword, { subject as resetPasswordSubject } from "./templates/reset-password.js";
import VerifyEmail, { subject as verifyEmailSubject } from "./templates/verify-email.js";
import WelcomeEmail, { subject as welcomeSubject } from "./templates/welcome.js";
import type { RenderedEmail, TemplateName, TemplateVarsByName } from "./types.js";

type TemplateRenderer<T extends TemplateName> = {
  subject: string;
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
};

export async function renderEmail<T extends TemplateName>(
  template: T,
  vars: TemplateVarsByName[T],
): Promise<RenderedEmail> {
  const entry = renderers[template] as TemplateRenderer<T>;
  const component = entry.component(vars);
  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { subject: entry.subject, html, text };
}
