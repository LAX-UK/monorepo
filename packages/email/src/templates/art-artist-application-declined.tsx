import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-artist-application-declined"];

export const subject = ({ reference }: Vars) =>
  `Your application to London Art Exchange (${reference})`;

/** A decline with the gallery's reason and the date the artist may apply again. */
export default function ArtArtistApplicationDeclinedEmail({
  artistName,
  reference,
  reason,
  reapplyFrom,
  applicationUrl,
}: Vars) {
  return (
    <Layout
      category="account"
      eyebrow="Artist application"
      preview="Thank you for sharing your work with us."
      title="About your application"
    >
      <TextBlock>Hi {artistName || "there"},</TextBlock>
      <TextBlock>
        Thank you for sharing your work with us. After a careful look at your application (
        {reference}), we are not able to offer representation at the moment.
      </TextBlock>
      <TextBlock>
        <strong>From the gallery:</strong> {reason}
      </TextBlock>
      <TextBlock>You are welcome to apply again from {reapplyFrom}, with new work.</TextBlock>
      <Button href={applicationUrl} tone="subtle">
        See your application
      </Button>
    </Layout>
  );
}
