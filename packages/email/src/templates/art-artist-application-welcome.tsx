import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["art-artist-application-welcome"];

export const subject = () => "Welcome to London Art Exchange";

/** Acceptance: the artist portal is open to the account they applied with. */
export default function ArtArtistApplicationWelcomeEmail({ artistName, portalUrl }: Vars) {
  return (
    <Layout
      category="account"
      eyebrow="Artist portal"
      preview="Your artist portal is ready."
      title="Welcome to the gallery"
    >
      <TextBlock>Hi {artistName || "there"},</TextBlock>
      <TextBlock>
        We are delighted to welcome you as a London Art Exchange artist. Your artist portal is
        ready: sign in with the same LAX Account you applied with.
      </TextBlock>
      <TextBlock>
        The portal shows your artworks, your sales and your payouts. The gallery team will be in
        touch about your profile on lax.art and the works to show first.
      </TextBlock>
      <Button href={portalUrl}>Open the artist portal</Button>
    </Layout>
  );
}
