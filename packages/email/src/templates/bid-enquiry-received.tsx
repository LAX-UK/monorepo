import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["bid-enquiry-received"];
type Kind = Vars["kind"];

export const subject = ({ reference }: Vars) => `We have your enquiry (${reference})`;

/** "Wednesday 4 November": the day the reply was promised, as a person in London reads it. */
export function replyByLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

const ASKED_TO: Record<Kind, (vars: Vars) => string> = {
  sell: () => "Sell privately",
  buy: () => "Buy privately",
  general: ({ topicLabel }) => topicLabel ?? "General enquiry",
};

/** The first lines say what was asked, in the words the sender used for it. */
const INTRO: Record<Kind, (vars: Vars, by: string) => string> = {
  sell: ({ departmentLabel }, by) =>
    `Thank you for asking us about selling a work privately. A specialist in our ${
      departmentLabel ? `${departmentLabel.toLowerCase()} team` : "team"
    } will reply within two business days, by ${by}.`,
  buy: (_vars, by) =>
    `Thank you for asking us about buying privately. A specialist will reply within two business days, by ${by}.`,
  general: (_vars, by) =>
    `Thank you for getting in touch. A member of our team will reply within two business days, by ${by}.`,
};

const SIGN_OFF: Record<Kind, string> = {
  sell: "LAX Bid specialists",
  buy: "LAX Bid specialists",
  general: "The LAX Bid team",
};

const PRIVATE_SALE_KINDS: ReadonlySet<Kind> = new Set<Kind>(["sell", "buy"]);

function greeting(recipientName: string | undefined): string {
  const first = recipientName?.trim().split(/\s+/)[0];
  return first ? `Dear ${first},` : "Hello,";
}

/**
 * The sender's copy of an enquiry to LAX Bid: the reference, what they asked, and the day to
 * expect an answer. Email is not a confidential channel, so it carries a short summary only:
 * never the photos or the price in mind.
 */
export default function BidEnquiryReceivedEmail(vars: Vars) {
  const { reference, kind, departmentLabel, work, photoCount, replyBy, privacyUrl, contactEmail } =
    vars;
  const by = replyByLabel(replyBy);
  return (
    <Layout
      category="account"
      eyebrow="Your enquiry"
      preview={`We have your enquiry. Your reference is ${reference}.`}
      privacyUrl={privacyUrl}
      footerReason="You are receiving this because you sent an enquiry on lax.bid."
      title="We have your enquiry"
    >
      <TextBlock>{greeting(vars.recipientName)}</TextBlock>
      <TextBlock>{INTRO[kind](vars, by)}</TextBlock>
      <FactCard
        rows={[
          { label: "Reference", value: reference, mono: true },
          { label: "You asked to", value: ASKED_TO[kind](vars) },
          { label: "Department", value: departmentLabel },
          { label: "Work", value: work },
          {
            label: "Photos",
            value: photoCount && photoCount > 0 ? `${photoCount} received` : undefined,
          },
        ]}
      />
      <TextBlock>
        {PRIVATE_SALE_KINDS.has(kind) ? "We treat every private sale enquiry in confidence. " : ""}
        If you need to add anything, write to {contactEmail} and quote the reference.
      </TextBlock>
      <TextBlock>{SIGN_OFF[kind]}</TextBlock>
    </Layout>
  );
}
