"use client";

import {
  EditorialEditor,
  type EditorialEditorConfig,
} from "@/components/editorial/editorial-editor.client";
import { ExhibitionFields } from "@/components/editorial/exhibition-fields.client";
import { PageFields } from "@/components/editorial/page-fields.client";
import { StoryFields } from "@/components/editorial/story-fields.client";
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

type EditorProps<D> = { detail: D | null; artPublicUrl: string | null };

const PAGE_CONFIG: EditorialEditorConfig<PageForm, PageDetail> = {
  entity: EDITORIAL_ENTITIES.pages,
  empty: emptyPageForm,
  fromDetail: pageFormFromDetail,
  buildPayload: buildPagePayload,
  nameOf: (form) => form.title,
  renderFields: (props) => <PageFields {...props} />,
};

const VENUE_CONFIG: EditorialEditorConfig<VenueForm, VenueDetail> = {
  entity: EDITORIAL_ENTITIES.venues,
  empty: emptyVenueForm,
  fromDetail: venueFormFromDetail,
  buildPayload: buildVenuePayload,
  nameOf: (form) => form.name,
  renderFields: (props) => <VenueFields {...props} />,
};

const STORY_CONFIG: EditorialEditorConfig<StoryForm, StoryDetail> = {
  entity: EDITORIAL_ENTITIES.stories,
  empty: emptyStoryForm,
  fromDetail: storyFormFromDetail,
  buildPayload: buildStoryPayload,
  nameOf: (form) => form.title,
  afterSave: (form) => ({ ...form, savedKind: form.kind }),
  renderFields: (props) => <StoryFields {...props} />,
};

export function PageEditor(props: EditorProps<PageDetail>) {
  return <EditorialEditor config={PAGE_CONFIG} {...props} />;
}

export function VenueEditor(props: EditorProps<VenueDetail>) {
  return <EditorialEditor config={VENUE_CONFIG} {...props} />;
}

export function StoryEditor(props: EditorProps<StoryDetail>) {
  return <EditorialEditor config={STORY_CONFIG} {...props} />;
}

export function ExhibitionEditor({
  venues,
  ...props
}: EditorProps<ExhibitionDetail> & { venues: readonly EditorialAdminRow[] }) {
  const config: EditorialEditorConfig<ExhibitionForm, ExhibitionDetail> = {
    entity: EDITORIAL_ENTITIES.exhibitions,
    empty: emptyExhibitionForm,
    fromDetail: exhibitionFormFromDetail,
    buildPayload: buildExhibitionPayload,
    nameOf: (form) => form.title,
    renderFields: (fields) => <ExhibitionFields {...fields} venues={venues} />,
  };
  return <EditorialEditor config={config} {...props} />;
}
