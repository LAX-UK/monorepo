import type { EditorialBlock, SeoFields } from "@auction/shop-contracts";
import type { EnquirySender } from "../enquiry-sender.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
  ArtworkSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

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
};

export type EditorialVenueSummaryReadModel = {
  slug: string;
  name: string;
  coverUrl: string | null;
};

export type EditorialVenueDetailReadModel = EditorialVenueSummaryReadModel & {
  address: string | null;
  postcode: string | null;
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
  /** Only a published venue, so the storefront never links to a 404. */
  venue: { slug: string; name: string } | null;
};

export type EditorialStorySummaryReadModel = {
  slug: string;
  kind: "article" | "film" | "press" | "guide";
  title: string;
  standfirst: string | null;
  coverUrl: string | null;
  featured: boolean;
  publishedAt: string | null;
};

/** Related records are published only, even on a draft preview. */
export type EditorialExhibitionDetailReadModel = EditorialExhibitionSummaryReadModel & {
  timesNote: string | null;
  venueSlug: string | null;
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
};

export type EditorialPageAdminDetail = EditorialAdminRow &
  SeoFields & {
    title: string;
    body: EditorialBlock[];
  };

export type EditorialVenueAdminDetail = EditorialAdminRow & {
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
  SeoFields & {
    kind: "article" | "film" | "press" | "guide";
    title: string;
    standfirst: string | null;
    coverMediaKey: string | null;
    videoUrl: string | null;
    featured: boolean;
    body: EditorialBlock[];
  };

export type EditorialExhibitionAdminDetail = EditorialAdminRow & {
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
  publishedAt: string | null;
};

export type EditorialRepository = {
  listAdminVenues(): Promise<EditorialAdminRow[]>;
  listAdminExhibitions(): Promise<EditorialAdminRow[]>;
  listAdminStories(): Promise<EditorialAdminRow[]>;
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
  listStories(
    kind?: "article" | "film" | "press" | "guide",
  ): Promise<EditorialStoryListItemReadModel[]>;
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
    topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
    contextSlug: string | null;
    message: string;
    phone: string | null;
  }): Promise<{ enquiryId: string }>;
  listGeneralEnquiriesForSubject(identitySubjectId: string): Promise<
    Array<{
      enquiryId: string;
      topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
      contextSlug: string | null;
      message: string;
      phone: string | null;
      createdAt: Date;
    }>
  >;
  listAdminGeneralEnquiries(input?: { limit?: number }): Promise<
    Array<{
      enquiryId: string;
      identitySubjectId: string | null;
      contactName: string | null;
      contactEmail: string | null;
      topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
      contextSlug: string | null;
      message: string;
      phone: string | null;
      createdAt: Date;
    }>
  >;
  getDraftEntityById(
    entity: "venue" | "exhibition" | "story" | "page",
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
    input: SeoFieldsInput & {
      slug: string;
      title: string;
      body: EditorialBlock[];
      updatedBy: string;
    },
  ): Promise<void>;
  setPagePublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminVenueById(id: string): Promise<EditorialVenueAdminDetail | null>;
  createVenue(input: {
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
  }): Promise<{ id: string }>;
  updateVenue(
    id: string,
    input: {
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
  ): Promise<void>;
  setVenuePublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminStoryById(id: string): Promise<EditorialStoryAdminDetail | null>;
  createStory(
    input: SeoFieldsInput & {
      slug: string;
      kind: "article" | "film" | "press" | "guide";
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
    input: SeoFieldsInput & {
      slug: string;
      kind: "article" | "film" | "press" | "guide";
      title: string;
      standfirst: string | null;
      coverMediaKey: string | null;
      videoUrl: string | null;
      featured: boolean;
      body: EditorialBlock[];
      updatedBy: string;
    },
  ): Promise<void>;
  setStoryPublication(id: string, published: boolean, updatedBy: string): Promise<void>;
  getAdminExhibitionById(id: string): Promise<EditorialExhibitionAdminDetail | null>;
  createExhibition(input: {
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
  }): Promise<{ id: string }>;
  updateExhibition(
    id: string,
    input: {
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
  ): Promise<void>;
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
    }>,
    updatedBy: string,
  ): Promise<void>;
};
