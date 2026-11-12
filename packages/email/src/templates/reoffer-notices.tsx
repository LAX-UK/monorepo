import { Button } from "../components/Button.js";
import { FactCard, type FactCardRow } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import {
  type ReofferNoticeCopy,
  offerAcceptedCopy,
  offerClosedCopy,
  offerMadeCopy,
  offerReminderCopy,
  reofferBindingTerms,
  reofferDayText,
  reofferDeadlineText,
  reofferStaffCopy,
  sellerConsentRequestCopy,
  sellerOutcomeCopy,
} from "../reoffer-copy.js";
import type { TemplateVarsByName } from "../types.js";

type NoticeProps = {
  eyebrow: string;
  copy: ReofferNoticeCopy;
  /** Greeting name; omitted for staff mail. */
  greetingName?: string | null | undefined;
  greet?: boolean;
  facts: FactCardRow[];
  /** Lines under the facts, such as the binding terms. */
  terms?: string[];
  action: { href: string; label: string };
  supportContactEmail: string;
};

/** The shape every re-offer email shares: words from the copy, the facts, one button, help. */
function Notice({
  eyebrow,
  copy,
  greetingName,
  greet = true,
  facts,
  terms,
  action,
  supportContactEmail,
}: NoticeProps) {
  return (
    <Layout
      category="alert"
      eyebrow={eyebrow}
      preview={copy.paragraphs[0] ?? copy.heading}
      title={copy.heading}
    >
      {greet ? <TextBlock>Hi {greetingName || "there"},</TextBlock> : null}
      {copy.paragraphs.map((paragraph) => (
        <TextBlock key={paragraph}>{paragraph}</TextBlock>
      ))}
      <FactCard rows={facts} />
      {terms ? (
        <>
          <TextBlock>The terms in short:</TextBlock>
          {terms.map((term) => (
            <TextBlock key={term}>{`• ${term}`}</TextBlock>
          ))}
        </>
      ) : null}
      <Button href={action.href}>{action.label}</Button>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}

type Vars<T extends keyof TemplateVarsByName> = TemplateVarsByName[T];

export const sellerConsentRequestSubject = (v: Vars<"reoffer-seller-consent-request">) =>
  sellerConsentRequestCopy(v).title;

export function SellerConsentRequestEmail(v: Vars<"reoffer-seller-consent-request">) {
  return (
    <Notice
      action={{ href: v.actionUrl, label: "Give your answer" }}
      copy={sellerConsentRequestCopy(v)}
      eyebrow="Sale update"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Offer price", value: v.price },
        { label: "Answer by", value: reofferDeadlineText(v.answerBy) },
      ]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
    />
  );
}

export const offerMadeSubject = (v: Vars<"reoffer-offer-made">) => offerMadeCopy(v).title;

export function OfferMadeEmail(v: Vars<"reoffer-offer-made">) {
  return (
    <Notice
      action={{ href: v.workspaceUrl, label: "Open your workspace" }}
      copy={offerMadeCopy(v)}
      eyebrow="Offer"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Price", value: v.price },
        { label: "Offer ends", value: reofferDeadlineText(v.windowEndsAt) },
      ]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
      terms={reofferBindingTerms(v.price)}
    />
  );
}

export const offerReminderSubject = (v: Vars<"reoffer-offer-reminder">) =>
  offerReminderCopy(v).title;

export function OfferReminderEmail(v: Vars<"reoffer-offer-reminder">) {
  return (
    <Notice
      action={{ href: v.workspaceUrl, label: "Open your workspace" }}
      copy={offerReminderCopy(v)}
      eyebrow="Offer reminder"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Price", value: v.price },
        { label: "Offer ends", value: reofferDeadlineText(v.windowEndsAt) },
      ]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
      terms={reofferBindingTerms(v.price)}
    />
  );
}

export const offerAcceptedSubject = (v: Vars<"reoffer-offer-accepted">) =>
  offerAcceptedCopy(v).title;

export function OfferAcceptedEmail(v: Vars<"reoffer-offer-accepted">) {
  return (
    <Notice
      action={{ href: v.workspaceUrl, label: "View your invoice" }}
      copy={offerAcceptedCopy(v)}
      eyebrow="Purchase"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Price", value: v.price },
        { label: "Invoice due", value: reofferDayText(v.invoiceDueAt) },
      ]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
    />
  );
}

export const offerClosedSubject = (v: Vars<"reoffer-offer-closed">) => offerClosedCopy(v).title;

export function OfferClosedEmail(v: Vars<"reoffer-offer-closed">) {
  return (
    <Notice
      action={{ href: v.workspaceUrl, label: "Open your workspace" }}
      copy={offerClosedCopy(v)}
      eyebrow="Offer"
      facts={[{ label: "Lot", value: v.lotTitle }]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
    />
  );
}

export const sellerOutcomeSubject = (v: Vars<"reoffer-seller-outcome">) =>
  sellerOutcomeCopy(v).title;

export function SellerOutcomeEmail(v: Vars<"reoffer-seller-outcome">) {
  return (
    <Notice
      action={{ href: v.actionUrl, label: "View the lot" }}
      copy={sellerOutcomeCopy(v)}
      eyebrow="Sale update"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Offer price", value: v.price },
      ]}
      greetingName={v.userName}
      supportContactEmail={v.supportContactEmail}
    />
  );
}

export const staffNoticeSubject = (v: Vars<"reoffer-staff-notice">) => reofferStaffCopy(v).title;

export function StaffNoticeEmail(v: Vars<"reoffer-staff-notice">) {
  return (
    <Notice
      action={{ href: v.adminUrl, label: "Open in admin" }}
      copy={reofferStaffCopy(v)}
      eyebrow="Admin · re-offer"
      facts={[
        { label: "Lot", value: v.lotTitle },
        { label: "Reference", value: v.lotReference, mono: true },
        { label: "Price", value: v.price },
        { label: "Bidder", value: v.bidderName },
      ]}
      greet={false}
      supportContactEmail={v.supportContactEmail}
    />
  );
}
