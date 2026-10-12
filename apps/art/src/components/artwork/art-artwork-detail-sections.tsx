import type { ArtworkSpecGroups, ArtworkSpecRow } from "@/lib/presenters/artwork-spec.presenter";
import {
  MarketingDetailAccordion,
  type MarketingDetailAccordionItem,
  MarketingUnderlineTabsPanel,
  type MarketingUnderlineTabsPanelItem,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";

export type ArtArtworkDetailSectionsProps = {
  specs: ArtworkSpecGroups;
  description: string | null;
  provenance: string | null;
  exhibitionHistory: string | null;
};

function SpecList({ rows }: { rows: readonly ArtworkSpecRow[] }) {
  return (
    <dl className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt>{row.label}</dt>
          <dd className="text-on-surface">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Prose({ text, className }: { text: string; className?: string }) {
  return <p className={cn("whitespace-pre-wrap", className)}>{text}</p>;
}

/** Bid lot-page structure: narrative tabs, then spec accordions (Details open by default). */
export function ArtArtworkDetailSections({
  specs,
  description,
  provenance,
  exhibitionHistory,
}: ArtArtworkDetailSectionsProps) {
  const tabs: MarketingUnderlineTabsPanelItem[] = [];
  if (description) {
    tabs.push({
      id: "about",
      label: "About this work",
      content: <Prose text={description} className="leading-7 text-on-surface-variant" />,
    });
  }
  if (exhibitionHistory) {
    tabs.push({
      id: "exhibitions",
      label: "Exhibition history",
      content: <Prose text={exhibitionHistory} className="leading-7 text-on-surface-variant" />,
    });
  }

  const accordion: MarketingDetailAccordionItem[] = [];
  if (specs.details.length > 0) {
    accordion.push({ id: "details", title: "Details", content: <SpecList rows={specs.details} /> });
  }
  if (specs.mediumAndDimensions.length > 0) {
    accordion.push({
      id: "medium",
      title: "Medium & dimensions",
      content: <SpecList rows={specs.mediumAndDimensions} />,
    });
  }
  if (provenance) {
    accordion.push({ id: "provenance", title: "Provenance", content: <Prose text={provenance} /> });
  }

  if (tabs.length === 0 && accordion.length === 0) return null;
  return (
    <div className="flex flex-col gap-8" data-testid="art-artwork-detail-sections">
      <MarketingUnderlineTabsPanel items={tabs} ariaLabel="About this work" />
      <MarketingDetailAccordion
        items={accordion}
        defaultOpen={accordion[0] ? [accordion[0].id] : []}
      />
    </div>
  );
}
