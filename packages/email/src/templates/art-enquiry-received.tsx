import { GALLERY_CONTACT } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-enquiry-received"];
type Topic = Vars["topic"];

export const subject = ({ reference }: Vars) => `We have your enquiry (${reference})`;

const TOPIC_LABEL: Record<Topic, string> = {
  artwork: "A work",
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling a work",
  exhibition: "Exhibition",
};

/** The second step depends on what was asked; the first is the same for everyone. */
const ANSWER_STEP: Record<Topic, string> = {
  artwork:
    "We answer your questions: price, condition, framing, delivery. Nothing is reserved or charged until you decide.",
  general: "We answer your questions by email, or by phone if you left a number.",
  private_viewing: "We suggest a quiet time to see the works at the gallery, by appointment.",
  art_advisory:
    "An advisor asks what you are looking for, for a home, an office or a first original, and comes back with works.",
  selling:
    "We point you to the right route: collectors sell through LAX Bid, and artists apply to be represented.",
  exhibition: "We answer your questions about the exhibition, its artists and the works shown.",
};

/**
 * The sender's copy of an enquiry: the reference they can quote, what it was about, what happens
 * next and how to reach the gallery directly.
 */
export default function ArtEnquiryReceivedEmail({
  reference,
  recipientName,
  topic,
  artworkTitle,
  artworkUrl,
}: Vars) {
  const about = topic === "artwork" && artworkTitle ? artworkTitle : TOPIC_LABEL[topic];
  const steps = [
    "A member of the gallery team reads your enquiry and replies within one working day.",
    ANSWER_STEP[topic],
  ];
  return (
    <Layout
      category="account"
      eyebrow="Your enquiry"
      preview={`Thank you for your enquiry. Your reference is ${reference}.`}
      title="Thank you for your enquiry"
    >
      <TextBlock>Hi {recipientName?.trim() || "there"},</TextBlock>
      <TextBlock>
        Thank you for getting in touch with London Art Exchange. This is your copy, with the
        reference to quote if you write or call.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Reference", value: reference, mono: true },
          { label: "About", value: about },
        ]}
      />
      <TextBlock>What happens next</TextBlock>
      {steps.map((step, index) => (
        <TextBlock key={step}>
          {index + 1}. {step}
        </TextBlock>
      ))}
      {topic === "artwork" && artworkUrl ? <Button href={artworkUrl}>See the work</Button> : null}
      <TextBlock>
        Prefer to talk? Call {GALLERY_CONTACT.phone} or write to {GALLERY_CONTACT.email}. The
        gallery is at {GALLERY_CONTACT.address}, {GALLERY_CONTACT.postcode}.{" "}
        {GALLERY_CONTACT.openingHours}
      </TextBlock>
    </Layout>
  );
}
