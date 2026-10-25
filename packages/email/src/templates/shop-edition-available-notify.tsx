import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = ({ artworkTitle }: TemplateVarsByName["shop-edition-available-notify"]) =>
  `${artworkTitle} is available again`;

export default function ShopEditionAvailableNotifyEmail({
  artworkTitle,
  artworkUrl,
  artistName,
  unsubscribeUrl,
}: TemplateVarsByName["shop-edition-available-notify"]) {
  const work = artistName ? `${artworkTitle} by ${artistName}` : artworkTitle;
  return (
    <Layout
      category="auction"
      eyebrow="Edition alert"
      preview={`An edition of ${work} is available again in LAX Shop.`}
      title={`${artworkTitle} is available again`}
      footerReason="You asked LAX Shop to email you once if an edition of this work became available again. This is that email; we will not write about it again."
      {...(unsubscribeUrl
        ? { unsubscribeUrl, unsubscribeLabel: "Stop all edition alerts to this address" }
        : {})}
    >
      <TextBlock>
        An edition of {work} can be bought again in LAX Shop. Editions are sold to whoever checks
        out first.
      </TextBlock>
      <Button href={artworkUrl}>View the edition</Button>
    </Layout>
  );
}
