import {
  MarketingDetailAccordion,
  type MarketingDetailAccordionItem,
  MarketingUnderlineTabsPanel,
  type MarketingUnderlineTabsPanelItem,
} from "@auction/marketing-ui";

export type ArtArtworkDetailSectionsProps = {
  description: string | null;
  provenance: string | null;
  exhibitionHistory: string | null;
};

function Prose({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap">{text}</p>;
}

/**
 * Figma 426:2581: "About the work" holds the Details and Provenance accordions (the facts are
 * shown once beside the image), "Exhibition history" its own tab.
 */
export function ArtArtworkDetailSections({
  description,
  provenance,
  exhibitionHistory,
}: ArtArtworkDetailSectionsProps) {
  const accordion: MarketingDetailAccordionItem[] = [];
  if (description) {
    accordion.push({ id: "details", title: "Details", content: <Prose text={description} /> });
  }
  if (provenance) {
    accordion.push({ id: "provenance", title: "Provenance", content: <Prose text={provenance} /> });
  }

  const tabs: MarketingUnderlineTabsPanelItem[] = [];
  if (accordion.length > 0) {
    tabs.push({
      id: "about",
      label: "About the work",
      content: (
        <MarketingDetailAccordion
          items={accordion}
          defaultOpen={accordion[0] ? [accordion[0].id] : []}
        />
      ),
    });
  }
  if (exhibitionHistory) {
    tabs.push({
      id: "exhibitions",
      label: "Exhibition history",
      content: (
        <div className="text-sm leading-7 text-on-surface-variant">
          <Prose text={exhibitionHistory} />
        </div>
      ),
    });
  }

  if (tabs.length === 0) return null;
  return (
    <div data-testid="art-artwork-detail-sections">
      <MarketingUnderlineTabsPanel items={tabs} ariaLabel="About this work" />
    </div>
  );
}
