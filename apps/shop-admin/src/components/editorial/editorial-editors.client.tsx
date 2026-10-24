"use client";

import { editorialEntityApi } from "@/components/editorial/editorial-editor-api";
import {
  EditorialEditor,
  type EditorialEditorConfig,
} from "@/components/editorial/editorial-editor.client";
import { ExhibitionFields } from "@/components/editorial/exhibition-fields.client";
import { PageFields } from "@/components/editorial/page-fields.client";
import { StoryFields } from "@/components/editorial/story-fields.client";
import { useEditorialLinks } from "@/components/editorial/use-editorial-links.client";
import { VenueFields } from "@/components/editorial/venue-fields.client";
import { EDITORIAL_ENTITIES } from "@/lib/editorial-entities";
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
import type { LinksPayload } from "@/server/domain/editorial-links.vm";

type EditorProps<D> = { detail: D | null; artPublicUrl: string | null };
/** `links` is what the links GET returned for a saved item; null for a new one. */
type LinkedEditorProps<D> = EditorProps<D> & { links?: LinksPayload | null };

const PAGE_CONFIG: EditorialEditorConfig<PageForm, PageDetail> = {
  entity: EDITORIAL_ENTITIES.pages,
  api: editorialEntityApi("pages"),
  empty: emptyPageForm,
  fromDetail: pageFormFromDetail,
  buildPayload: buildPagePayload,
  nameOf: (form) => form.title,
  renderFields: (props) => <PageFields {...props} />,
};

const VENUE_CONFIG: EditorialEditorConfig<VenueForm, VenueDetail> = {
  entity: EDITORIAL_ENTITIES.venues,
  api: editorialEntityApi("venues"),
  empty: emptyVenueForm,
  fromDetail: venueFormFromDetail,
  buildPayload: buildVenuePayload,
  nameOf: (form) => form.name,
  renderFields: (props) => <VenueFields {...props} />,
};

export function PageEditor(props: EditorProps<PageDetail>) {
  return <EditorialEditor config={PAGE_CONFIG} {...props} />;
}

export function VenueEditor(props: EditorProps<VenueDetail>) {
  return <EditorialEditor config={VENUE_CONFIG} {...props} />;
}

export function StoryEditor({ links, ...props }: LinkedEditorProps<StoryDetail>) {
  const linkState = useEditorialLinks("stories", props.detail?.id ?? null, links ?? null);
  const config: EditorialEditorConfig<StoryForm, StoryDetail> = {
    entity: EDITORIAL_ENTITIES.stories,
    api: editorialEntityApi("stories"),
    empty: emptyStoryForm,
    fromDetail: storyFormFromDetail,
    buildPayload: buildStoryPayload,
    nameOf: (form) => form.title,
    afterSave: (form) => ({ ...form, savedKind: form.kind }),
    renderFields: (fields) => <StoryFields {...fields} />,
    linksBeforeFirstSave: "Artists, artworks and exhibitions",
  };
  return <EditorialEditor config={config} links={linkState} {...props} />;
}

export function ExhibitionEditor({
  venues,
  links,
  ...props
}: LinkedEditorProps<ExhibitionDetail> & { venues: readonly EditorialAdminRow[] }) {
  const linkState = useEditorialLinks("exhibitions", props.detail?.id ?? null, links ?? null);
  const config: EditorialEditorConfig<ExhibitionForm, ExhibitionDetail> = {
    entity: EDITORIAL_ENTITIES.exhibitions,
    api: editorialEntityApi("exhibitions"),
    empty: emptyExhibitionForm,
    fromDetail: exhibitionFormFromDetail,
    buildPayload: buildExhibitionPayload,
    nameOf: (form) => form.title,
    renderFields: (fields) => <ExhibitionFields {...fields} venues={venues} />,
    linksBeforeFirstSave: "Artworks, artists and related stories",
  };
  return <EditorialEditor config={config} links={linkState} {...props} />;
}
