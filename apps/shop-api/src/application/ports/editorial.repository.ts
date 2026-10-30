import type {
  EditorialBlock,
  EditorialStoryCategory,
  EditorialStoryKind,
  EditorialStoryListQuery,
  SeoFields,
} from "@auction/shop-contracts";
import type { EnquirySender } from "../enquiry-sender.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
  ArtworkSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

/**
 * What a general enquiry is about. `order_problem` comes only from "Report a problem" on a Shop
 * order; the public enquiry form offers the others.
 */
export type GeneralEnquiryTopic =
  | "general"
  | "private_viewing"
  | "art_advisory"
  | "selling"
  | "exhibition"
  | "order_problem";

/** Omitted leaves the stored value unchanged on update; `null` clears it. */
type SeoFieldsInput = Partial<SeoFields>;

export type EditorialHomePlacementReadModel = {
  slot: string;
  position: number;
  headline: string | null;
  mediaUrl: string | null;
  linkUrl: string | null;
  refKind: string;
  refSlug: string | null;
  body: string | null;
  ctaLabel: string | null;
};

export type EditorialVenueSummaryReadModel = {
  slug: string;
  name: string;
  coverUrl: string | null;
  streetLine: string | null;
  postcode: string | null;
  city: string | null;
};

export type EditorialVenueDetailReadModel = EditorialVenueSummaryReadModel & {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: unknown | null;
  phone: string | null;
  email: string | null;
  mapUrl: string | null;
  body: EditorialBlock[];
};

export type EditorialExhibitionSummaryReadModel = {
  slug: string;
  kind: "exhibition" | "film" | "event";
  title: string;
  summary: string | null;
  startsOn: string | null;
  endsOn: string | null;
  coverUrl: string | null;
  featured: boolean;
  subtitle: string | null;
  /** Only a published venue, so the storefront never links to a 404. */
  venue: { slug: string; name: string } | null;
};

export type EditorialExhibitionContactReadModel = {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type EditorialStorySummaryReadModel = {
  slug: string;
  kind: EditorialStoryKind;
  /** The editor's category, or the default for `kind` when left blank. */
  category: EditorialStoryCategory;
  title: string;
  standfirst: string | null;
  coverUrl: string | null;
  featured: boolean;
  publishedAt: string | null;
  authorName: string | null;
  readMinutes: number | null;
  series: string | null;
  episodeNumber: number | null;
  durationSeconds: number | null;
  publicationName: string | null;
  externalUrl: string | null;
};

/** Related records are published only, even on a draft preview. */
export type EditorialExhibitionDetailReadModel = EditorialExhibitionSummaryReadModel & {
  timesNote: string | null;
  venueSlug: string | null;
  /** Null when the editor named no contact. */
  contact: EditorialExhibitionContactReadModel | null;
  body: EditorialBlock[];
  installationMedia: { url: string; caption: string | null }[];
  artworks: ArtworkSummaryReadModel[];
  artists: ArtistDetailReadModel[];
  stories: EditorialStorySummaryReadModel[];
};

export type EditorialArtistRelationsReadModel = {
  exhibitions: EditorialExhibitionSummaryReadModel[];
  stories: EditorialStorySummaryReadModel[];
};

export type EditorialStoryListItemReadModel = EditorialStorySummaryReadModel & {
  updatedAt: string;
};

export type EditorialPageSummaryReadModel = {
  slug: string;
  title: string;
  updatedAt: string;
};

export type EditorialStoryDetailReadModel = EditorialStorySummaryReadModel &
  SeoFields & {
    videoUrl: string | null;
    audioUrl: string | null;
    body: EditorialBlock[];
    related: {
      artists: ArtistSummaryReadModel[];
      artworks: ArtworkSummaryReadModel[];
      exhibitions: EditorialExhibitionSummaryReadModel[];
    };
  };

export type EditorialPageDetailReadModel = SeoFields & {
  slug: string;
  title: string;
  body: EditorialBlock[];
};

export type EditorialAdminRow = {
  id: string;
  slug: string;
  status: "draft" | "published";
  label: string;
  /** The row's `updatedAt` as ISO text; send it back as `expectedVersion` when saving. */
  updatedAt: string;
};

export type EditorialVenueListRow = EditorialAdminRow & { city: string | null };
export type EditorialStoryListRow = EditorialAdminRow & { kind: EditorialStoryKind };
export type EditorialExhibitionListRow = EditorialAdminRow & {
  kind: "exhibition" | "film" | "event";
  startsOn: string | null;
  endsOn: string | null;
};

/**
 * `stale` means the row changed since `expectedVersion` and nothing was written. Saves compare
 * the version inside the UPDATE itself, so two concurrent saves cannot both succeed.
 */
export type EditorialUpdateOutcome =
  | { status: "updated"; version: string }
  | { status: "not_found" }
  | { status: "stale"; currentVersion: string };

type ExpectedVersion = { expectedVersion: string };

export type EditorialPageAdminDetail = EditorialAdminRow &
  SeoFields & {
    title: string;
    body: EditorialBlock[];
  };

/** Content fields added after launch: omitted on write leaves the stored value; `null` clears it. */
export type EditorialVenueExtraFields = {
  streetLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type EditorialStoryExtraFields = {
  /** Null means "derive from kind". */
  category: EditorialStoryCategory | null;
  authorName: string | null;
  /** Null asks the repository to estimate from the body. */
  readMinutes: number | null;
  series: string | null;
  episodeNumber: number | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  publicationName: string | null;
  externalUrl: string | null;
};

export type EditorialExhibitionExtraFields = {
  subtitle: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatarMediaKey: string | null;
};

export type EditorialVenueAdminDetail = EditorialAdminRow &
  EditorialVenueExtraFields & {
    name: string;
    address: string | null;
    postcode: string | null;
    openingHours: unknown | null;
    phone: string | null;
    email: string | null;
    mapUrl: string | null;
    coverMediaKey: string | null;
    body: EditorialBlock[];
  };

export type EditorialStoryAdminDetail = EditorialAdminRow &
  SeoFields &
  EditorialStoryExtraFields & {
    kind: EditorialStoryKind;
    title: string;
    standfirst: string | null;
    coverMediaKey: string | null;
    videoUrl: string | null;
    featured: boolean;
    body: EditorialBlock[];
  };

export type EditorialExhibitionAdminDetail = EditorialAdminRow &
  EditorialExhibitionExtraFields & {
    kind: "exhibition" | "film" | "event";
    title: string;
    summary: string | null;
    venueId: string | null;
    startsOn: string | null;
    endsOn: string | null;
    timesNote: string | null;
    coverMediaKey: string | null;
    featured: boolean;
    body: EditorialBlock[];
  };

export type EditorialPlacementAdminRow = {
  id: string;
  slot: string;
  position: number;
  refKind: string;
  refId: string | null;
  headline: string | null;
  mediaKey: string | null;
  linkUrl: string | null;
  body: string | null;
  ctaLabel: string | null;
  publishedAt: string | null;
};

export type EditorialRepository = {
  listAdminVenues(): Promise<EditorialVenueListRow[]>;
  listAdminExhibitions(): Promise<EditorialExhibitionListRow[]>;
  listAdminStories(): Promise<EditorialStoryListRow[]>;
  listAdminPages(): Promise<EditorialAdminRow[]>;
  getHomePlacements(): Promise<EditorialHomePlacementReadModel[]>;
  listVenues(): Promise<EditorialVenueSummaryReadModel[]>;
  getVenueBySlug(
    slug: string,
    options?: { includeDraft?: boolean },
  ): Promise<EditorialVenueDetailReadModel | null>;
  listExhibitions(
    status: "current" | "upcoming" | "past",
  ): Promise<EditorialExhibitionSummaryReadModel[]>;
  getExhibitionBySlug(
    slug: string,
    options?: { includeDraft?: boolean },
  ): Promise<EditorialExhibitionDetailReadModel | null>;
  listStories(filter?: EditorialStoryListQuery): Promise<EditorialStoryListItemReadModel[]>;
  getStoryBySlug(
    slug: string,
    options?: { includeDraft?: boolean },
  ): Promise<EditorialStoryDetailReadModel | null>;
  /** Null when no artist has this slug. */
  getArtistRelations(artistSlug: string): Promise<EditorialArtistRelationsReadModel | null>;
  listPages(): Promise<EditorialPageSummaryReadModel[]>;
  getPageBySlug(
    slug: string,
    options?: { includeDraft?: boolean },
  ): Promise<EditorialPageDetailReadModel | null>;
  insertGeneralEnquiry(input: {
    sender: EnquirySender;
    topic: GeneralEnquiryTopic;
    contextSlug: string | null;
    message: string;
    phone: string | null;
  }): Promise<{ enquiryId: string; reference: string }>;
  listGeneralEnquiriesForSubject(identitySubjectId: string): Promise<
    Array<{
      enquiryId: string;
      topic: Exclude<GeneralEnquiryTopic, "order_problem">;
      contextSlug: string | null;
      message: string;
      phone: string | null;
      createdAt: Date;
    }>
  >;
  getDraftEntityById(
    entity: "venue" | "exhibition" | "story" | "page" | "help_article",
    id: string,
  ): Promise<
    | EditorialVenueDetailReadModel
    | EditorialExhibitionDetailReadModel
    | EditorialStoryDetailReadModel
    | EditorialPageDetailReadModel
    | null
  >;
  getAdminPageById(id: string): Promise<EditorialPageAdminDetail | null>;
  createPage(
    input: SeoFieldsInput & {
      slug: string;
      title: string;
      body: EditorialBlock[];
      updatedBy: string;
    },
  ): Promise<{ id: string }>;
  updatePage(
    id: string,
    input: ExpectedVersion &
      SeoFieldsInput & {
        slug: string;
        title: string;
        body: EditorialBlock[];
        updatedBy: string;
      },
  ): Promise<EditorialUpdateOutcome>;
  setPagePublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminVenueById(id: string): Promise<EditorialVenueAdminDetail | null>;
  createVenue(
    input: Partial<EditorialVenueExtraFields> & {
      slug: string;
      name: string;
      address: string | null;
      postcode: string | null;
      openingHours: unknown | null;
      phone: string | null;
      email: string | null;
      mapUrl: string | null;
      coverMediaKey: string | null;
      body: EditorialBlock[];
      updatedBy: string;
    },
  ): Promise<{ id: string }>;
  updateVenue(
    id: string,
    input: ExpectedVersion &
      Partial<EditorialVenueExtraFields> & {
        slug: string;
        name: string;
        address: string | null;
        postcode: string | null;
        openingHours: unknown | null;
        phone: string | null;
        email: string | null;
        mapUrl: string | null;
        coverMediaKey: string | null;
        body: EditorialBlock[];
        updatedBy: string;
      },
  ): Promise<EditorialUpdateOutcome>;
  setVenuePublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminStoryById(id: string): Promise<EditorialStoryAdminDetail | null>;
  createStory(
    input: SeoFieldsInput &
      Partial<EditorialStoryExtraFields> & {
        slug: string;
        kind: EditorialStoryKind;
        title: string;
        standfirst: string | null;
        coverMediaKey: string | null;
        videoUrl: string | null;
        featured: boolean;
        body: EditorialBlock[];
        updatedBy: string;
      },
  ): Promise<{ id: string }>;
  updateStory(
    id: string,
    input: ExpectedVersion &
      SeoFieldsInput &
      Partial<EditorialStoryExtraFields> & {
        slug: string;
        kind: EditorialStoryKind;
        title: string;
        standfirst: string | null;
        coverMediaKey: string | null;
        videoUrl: string | null;
        featured: boolean;
        body: EditorialBlock[];
        updatedBy: string;
      },
  ): Promise<EditorialUpdateOutcome>;
  setStoryPublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminExhibitionById(id: string): Promise<EditorialExhibitionAdminDetail | null>;
  createExhibition(
    input: Partial<EditorialExhibitionExtraFields> & {
      slug: string;
      kind: "exhibition" | "film" | "event";
      title: string;
      summary: string | null;
      venueId: string | null;
      startsOn: string | null;
      endsOn: string | null;
      timesNote: string | null;
      coverMediaKey: string | null;
      featured: boolean;
      body: EditorialBlock[];
      updatedBy: string;
    },
  ): Promise<{ id: string }>;
  updateExhibition(
    id: string,
    input: ExpectedVersion &
      Partial<EditorialExhibitionExtraFields> & {
        slug: string;
        kind: "exhibition" | "film" | "event";
        title: string;
        summary: string | null;
        venueId: string | null;
        startsOn: string | null;
        endsOn: string | null;
        timesNote: string | null;
        coverMediaKey: string | null;
        featured: boolean;
        body: EditorialBlock[];
        updatedBy: string;
      },
  ): Promise<EditorialUpdateOutcome>;
  setExhibitionPublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  listAdminPlacements(): Promise<EditorialPlacementAdminRow[]>;
  replacePlacementSlot(
    slot: string,
    items: Array<{
      position: number;
      refKind: string;
      refId: string | null;
      headline: string | null;
      mediaKey: string | null;
      linkUrl: string | null;
      body?: string | null;
      ctaLabel?: string | null;
    }>,
    updatedBy: string,
  ): Promise<void> /** Preview tokens grant read access to drafts, so each issue is audited. */;
  recordPreviewTokenIssued(
    entity: "venue" | "exhibition" | "story" | "page" | "help_article",
    id: string,
    actorSubjectId: string,
  ): Promise<void>;
};
