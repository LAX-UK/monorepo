import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import { MarketingDetailAccordion } from "@auction/marketing-ui";

/**
 * "About limited editions": what a limited edition is, closed until opened, after the facts block.
 * The sentence is written by shop-domain; this only places it in the shared detail accordion.
 */
export function ArtworkEditionExplainer({ statement }: { statement: string }) {
  return (
    <div className="shop-edition-explainer">
      <MarketingDetailAccordion
        items={[
          { id: "limited-editions", title: EDITION_PAGE_COPY.explainerTitle, content: statement },
        ]}
      />
    </div>
  );
}
