import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = ({ artworkTitle }: TemplateVarsByName["shop-release-alert"]) =>
  `New edition: ${artworkTitle}`;

export default function ShopReleaseAlertEmail({
  artworkTitle,
  artistName,
  artworkUrl,
  unsubscribeUrl,
}: TemplateVarsByName["shop-release-alert"]) {
  const work = artistName ? `${artworkTitle} by ${artistName}` : artworkTitle;
  return (
    <Layout
      category="auction"
      eyebrow="New edition"
      preview={`${work} is now available in LAX Shop.`}
      title={artworkTitle}
      footerReason="You asked LAX Shop to email you when a new edition is released."
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeLabel="Stop release alerts to this address"
    >
      <TextBlock>
        {work} has been released in LAX Shop. Editions are sold to whoever checks out first.
      </TextBlock>
      <Button href={artworkUrl}>View the edition</Button>
    </Layout>
  );
}
