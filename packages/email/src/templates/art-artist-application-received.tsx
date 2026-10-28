import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-artist-application-received"];

export const subject = ({ reference }: Vars) => `We have your application (${reference})`;

/** The applicant's copy: their reference, what happens next and when to expect a reply. */
export default function ArtArtistApplicationReceivedEmail({
  artistName,
  reference,
  replyWeeks,
  applicationUrl,
}: Vars) {
  return (
    <Layout
      category="account"
      eyebrow="Artist application"
      preview={`Thank you for applying to London Art Exchange. Your reference is ${reference}.`}
      title="Thank you for applying"
    >
      <TextBlock>Hi {artistName || "there"},</TextBlock>
      <TextBlock>
        Thank you for applying to be represented by London Art Exchange. We have your application
        and the works you sent with it.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Reference", value: reference, mono: true },
          { label: "Status", value: "Submitted" },
        ]}
      />
      <TextBlock>
        The gallery team looks at every application. We reply within {replyWeeks} weeks, and we will
        write sooner if we have a question.
      </TextBlock>
      <Button href={applicationUrl}>See your application</Button>
    </Layout>
  );
}
