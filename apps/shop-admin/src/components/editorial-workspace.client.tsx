"use client";

import {
  ExhibitionFields,
  PageFields,
  StoryFields,
  VenueFields,
} from "@/components/editorial-entity-fields.client";
import {
  EditorialEntityTab,
  type EditorialEntityTabConfig,
} from "@/components/editorial-entity-tab.client";
import { EditorialPlacementsTab } from "@/components/editorial-placements-tab.client";
import {
  type EditorialAdminRow,
  type ExhibitionDetail,
  type ExhibitionForm,
  type PageDetail,
  type PageForm,
  type StoryDetail,
  type StoryForm,
  type VenueDetail,
  type VenueForm,
  buildExhibitionPayload,
  buildPagePayload,
  buildStoryPayload,
  buildVenuePayload,
  emptyExhibitionForm,
  emptyPageForm,
  emptyStoryForm,
  emptyVenueForm,
  exhibitionFormFromDetail,
  pageFormFromDetail,
  storyFormFromDetail,
  venueFormFromDetail,
} from "@/lib/editorial-entity-forms";
import type { AdminPlacementRow } from "@/lib/editorial-placements";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

const TABS = [
  { id: "pages", label: "Pages" },
  { id: "venues", label: "Venues" },
  { id: "exhibitions", label: "Exhibitions" },
  { id: "stories", label: "Stories" },
  { id: "placements", label: "Home placements" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PAGE_CONFIG: EditorialEntityTabConfig<PageForm, PageDetail> = {
  kind: "pages",
  singular: "page",
  plural: "pages",
  empty: emptyPageForm,
  fromDetail: pageFormFromDetail,
  buildPayload: buildPagePayload,
  renderFields: (props) => <PageFields {...props} />,
};

const VENUE_CONFIG: EditorialEntityTabConfig<VenueForm, VenueDetail> = {
  kind: "venues",
  singular: "venue",
  plural: "venues",
  empty: emptyVenueForm,
  fromDetail: venueFormFromDetail,
  buildPayload: buildVenuePayload,
  renderFields: (props) => <VenueFields {...props} />,
};

const STORY_CONFIG: EditorialEntityTabConfig<StoryForm, StoryDetail> = {
  kind: "stories",
  singular: "story",
  plural: "stories",
  empty: emptyStoryForm,
  fromDetail: storyFormFromDetail,
  buildPayload: buildStoryPayload,
  renderFields: (props) => <StoryFields {...props} />,
};

function exhibitionConfig(
  venues: readonly EditorialAdminRow[],
): EditorialEntityTabConfig<ExhibitionForm, ExhibitionDetail> {
  return {
    kind: "exhibitions",
    singular: "exhibition",
    plural: "exhibitions",
    empty: emptyExhibitionForm,
    fromDetail: exhibitionFormFromDetail,
    buildPayload: buildExhibitionPayload,
    renderFields: (props) => <ExhibitionFields {...props} venues={venues} />,
  };
}

export type EditorialWorkspaceProps = {
  pages: EditorialAdminRow[];
  venues: EditorialAdminRow[];
  exhibitions: EditorialAdminRow[];
  stories: EditorialAdminRow[];
  placements: AdminPlacementRow[];
  artPublicUrl: string | null;
};

export function EditorialWorkspace({
  pages,
  venues,
  exhibitions,
  stories,
  placements,
  artPublicUrl,
}: EditorialWorkspaceProps) {
  const baseId = useId();
  const [active, setActive] = useState<TabId>("pages");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let nextIndex: number | null = null;
    if (event.key in offsets) {
      nextIndex = (index + (offsets[event.key] ?? 0) + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }
    const next = nextIndex === null ? undefined : TABS[nextIndex];
    if (!next) return;
    event.preventDefault();
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  }

  const panels: Record<TabId, ReactNode> = {
    pages: <EditorialEntityTab config={PAGE_CONFIG} rows={pages} artPublicUrl={artPublicUrl} />,
    venues: <EditorialEntityTab config={VENUE_CONFIG} rows={venues} artPublicUrl={artPublicUrl} />,
    exhibitions: (
      <EditorialEntityTab
        config={exhibitionConfig(venues)}
        rows={exhibitions}
        artPublicUrl={artPublicUrl}
      />
    ),
    stories: (
      <EditorialEntityTab config={STORY_CONFIG} rows={stories} artPublicUrl={artPublicUrl} />
    ),
    placements: (
      <EditorialPlacementsTab
        placements={placements}
        refLists={{ exhibition: exhibitions, story: stories, page: pages, venue: venues }}
      />
    ),
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Editorial sections" className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                selected
                  ? "border-primary font-medium text-on-surface"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={tab.id !== active}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
