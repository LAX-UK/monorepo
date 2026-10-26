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
import { EDITORIAL_ENTITIES, editorialListHref } from "@/lib/editorial-entities";
import {
  type EditorialAdminRow,
  type EditorialEntityKind,
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
import { editorialPublicAddress } from "@/server/domain/editorial-publication.vm";

type EditorProps<D> = { detail: D | null; artPublicUrl: string | null };

/** The page chrome and public address every editorial editor shares. */
function chrome(kind: EditorialEntityKind, artPublicUrl: string | null) {
  const entity = EDITORIAL_ENTITIES[kind];
  return {
    entity,
    api: editorialEntityApi(kind),
    page: {
      list: { label: entity.title, href: editorialListHref(kind) },
      newTitle: entity.newLabel,
    },
    publicAddress: (form: { slug: string }) =>
      editorialPublicAddress(kind, form.slug.trim(), artPublicUrl),
  };
}
/** `links` is what the links GET returned for a saved item; null for a new one. */
type LinkedEditorProps<D> = EditorProps<D> & { links?: LinksPayload | null };

const pageConfig = (artPublicUrl: string | null): EditorialEditorConfig<PageForm, PageDetail> => ({
  ...chrome("pages", artPublicUrl),
  empty: emptyPageForm,
  fromDetail: pageFormFromDetail,
  buildPayload: buildPagePayload,
  nameOf: (form) => form.title,
  renderFields: (props) => <PageFields {...props} />,
});

const venueConfig = (
  artPublicUrl: string | null,
): EditorialEditorConfig<VenueForm, VenueDetail> => ({
  ...chrome("venues", artPublicUrl),
  empty: emptyVenueForm,
  fromDetail: venueFormFromDetail,
  buildPayload: buildVenuePayload,
  nameOf: (form) => form.name,
  renderFields: (props) => <VenueFields {...props} />,
});

export function PageEditor(props: EditorProps<PageDetail>) {
  return <EditorialEditor config={pageConfig(props.artPublicUrl)} {...props} />;
}

export function VenueEditor(props: EditorProps<VenueDetail>) {
  return <EditorialEditor config={venueConfig(props.artPublicUrl)} {...props} />;
}

export function StoryEditor({ links, ...props }: LinkedEditorProps<StoryDetail>) {
  const linkState = useEditorialLinks("stories", props.detail?.id ?? null, links ?? null);
  const config: EditorialEditorConfig<StoryForm, StoryDetail> = {
    ...chrome("stories", props.artPublicUrl),
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
    ...chrome("exhibitions", props.artPublicUrl),
    empty: emptyExhibitionForm,
    fromDetail: exhibitionFormFromDetail,
    buildPayload: buildExhibitionPayload,
    nameOf: (form) => form.title,
    renderFields: (fields) => <ExhibitionFields {...fields} venues={venues} />,
    linksBeforeFirstSave: "Artworks, artists and related stories",
  };
  return <EditorialEditor config={config} links={linkState} {...props} />;
}
