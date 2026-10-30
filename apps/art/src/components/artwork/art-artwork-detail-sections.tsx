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
 * Figma 426:2581: "About the work" shows the description directly; secondary, longer content
 * (provenance) sits in an accordion beneath it. "Exhibition history" is its own tab. The facts
 * are shown once beside the image.
 */
export function ArtArtworkDetailSections({
  description,
  provenance,
  exhibitionHistory,
}: ArtArtworkDetailSectionsProps) {
  const secondary: MarketingDetailAccordionItem[] = [];
  if (provenance) {
    secondary.push({ id: "provenance", title: "Provenance", content: <Prose text={provenance} /> });
  }

  const tabs: MarketingUnderlineTabsPanelItem[] = [];
  if (description || secondary.length > 0) {
    tabs.push({
      id: "about",
      label: "About the work",
      content: (
        <div className="flex flex-col gap-6">
          {description ? (
            <div
              className="max-w-[65ch] text-base leading-7 text-on-surface"
              data-testid="art-artwork-description"
            >
              <Prose text={description} />
            </div>
          ) : null}
          {secondary.length > 0 ? <MarketingDetailAccordion items={secondary} /> : null}
        </div>
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
