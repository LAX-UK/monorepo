import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-artist-application-more-info"];

export const subject = ({ reference }: Vars) => `A question about your application (${reference})`;

/** The gallery's question, and how to answer it: in the application, which keeps its place. */
export default function ArtArtistApplicationMoreInfoEmail({
  artistName,
  reference,
  message,
  applicationUrl,
}: Vars) {
  return (
    <Layout
      category="account"
      eyebrow="Artist application"
      preview="The gallery team would like to know a little more before deciding."
      title="The gallery has a question"
    >
      <TextBlock>Hi {artistName || "there"},</TextBlock>
      <TextBlock>
        Thank you for your application ({reference}). Before we decide, the gallery team would like
        to know a little more.
      </TextBlock>
      <TextBlock>
        <strong>From the gallery:</strong> {message}
      </TextBlock>
      <TextBlock>
        Open your application, make the changes or add the details, and send it back. It keeps its
        place with the same reviewer.
      </TextBlock>
      <Button href={applicationUrl}>Answer the question</Button>
    </Layout>
  );
}
