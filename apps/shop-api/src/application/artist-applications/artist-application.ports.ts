import type {
  AdminArtistApplicationDetail,
  AdminArtistApplicationListResponse,
  ArtistApplicationQueueView,
  ArtistApplicationReviewer,
} from "@auction/shop-contracts";
import type {
  ArtistApplicationAction,
  ArtistApplicationContent,
  ArtistApplicationStatus,
} from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";

/** One application as the use cases see it: its content plus where it stands. */
export type ArtistApplicationRecord = {
  id: string;
  reference: string;
  applicantSubjectId: string;
  status: ArtistApplicationStatus;
  content: ArtistApplicationContent;
  contactEmail: string | null;
  assigneeSubject: string | null;
  messageToArtist: string | null;
  artistId: string | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  version: number;
  updatedAt: Date;
  /** Where each work's image is served, and its size, by media key. */
  images: ReadonlyMap<string, ArtistApplicationImage>;
};

export type ArtistApplicationImage = {
  url: string | null;
  width: number | null;
  height: number | null;
};

/** Fields a status change may set alongside the status. Undefined leaves a field alone. */
export type ArtistApplicationStatePatch = {
  status: ArtistApplicationStatus;
  assigneeSubject?: string | null;
  messageToArtist?: string | null;
  contactEmail?: string | null;
  artistId?: string | null;
  submittedAt?: Date;
  decidedAt?: Date | null;
};

/**
 * Applications inside one transaction. `lock` takes a row lock, so two people acting on the
 * same application queue behind each other and the version check sees the winner's change.
 * Every write bumps the version.
 */
export interface ArtistApplicationStore {
  latestForApplicant(applicantSubjectId: string): Promise<ArtistApplicationRecord | null>;
  lock(id: string): Promise<ArtistApplicationRecord | null>;
  insertDraft(applicantSubjectId: string): Promise<ArtistApplicationRecord>;
  saveContent(id: string, content: ArtistApplicationContent): Promise<void>;
  /** Adds an uploaded image as the next work, with nothing said about it yet. */
  appendWork(id: string, mediaKey: string): Promise<void>;
  setState(id: string, patch: ArtistApplicationStatePatch): Promise<void>;
  appendEvent(event: {
    applicationId: string;
    action: ArtistApplicationAction;
    actorSubjectId: string;
    message?: string | null;
    assigneeSubject?: string | null;
  }): Promise<void>;
}

/** The account the applicant applies with: where to write to them, and their name. */
export interface ApplicantDirectory {
  contactFor(subject: string): Promise<{ email: string | null; name: string | null }>;
}

/**
 * Turning an accepted application into a gallery artist: the profile, the portal access through
 * the same link staff make by hand, and optionally the works as draft artworks.
 */
export interface ArtistOnboarding {
  createArtistProfile(input: {
    applicationId: string;
    displayName: string;
    slug: string;
    shortBio: string | null;
    bio: string | null;
    actorSubjectId: string;
  }): Promise<{ artistId: string; slug: string }>;
  grantPortalAccess(input: {
    applicationId: string;
    artistId: string;
    identitySubjectId: string;
    actorSubjectId: string;
  }): Promise<void>;
  importDraftArtworks(input: {
    applicationId: string;
    artistId: string;
    artistSlug: string;
    works: ArtistApplicationContent["works"];
    actorSubjectId: string;
  }): Promise<number>;
}

/** Mail to the applicant, queued in the same transaction as the change it reports. */
export interface ArtistApplicationNotifier {
  received(input: { to: string; reference: string; artistName: string }): Promise<void>;
  moreInformationNeeded(input: {
    to: string;
    reference: string;
    artistName: string;
    message: string;
  }): Promise<void>;
  declined(input: {
    to: string;
    reference: string;
    artistName: string;
    reason: string;
    reapplyFrom: Date;
  }): Promise<void>;
  welcome(input: {
    to: string;
    reference: string;
    artistName: string;
    artistSlug: string;
  }): Promise<void>;
}

export type ArtistApplicationTx = {
  applications: ArtistApplicationStore;
  applicants: ApplicantDirectory;
  onboarding: ArtistOnboarding;
  notifier: ArtistApplicationNotifier;
  audit: ShopAdminAuditWriter;
};

export interface ArtistApplicationUnitOfWork {
  run<T>(fn: (tx: ArtistApplicationTx) => Promise<T>): Promise<T>;
}

/** Staff who may review applications: active, with the review capability. */
export interface ArtistApplicationReviewers {
  list(): Promise<ArtistApplicationReviewer[]>;
  canReview(subject: string): Promise<boolean>;
}

export type ArtistApplicationQueueFilters = {
  view: ArtistApplicationQueueView;
  assignee?: { type: "unassigned" } | { type: "subject"; subject: string };
  /** Free text over the artist name, location, reference and the applicant's email. */
  q?: string;
};

export type ArtistApplicationQueueCursor = { submittedAt: string; id: string };

/** Staff reads of sent applications. Drafts are never listed. */
export interface ArtistApplicationQueueReader {
  list(input: {
    filters: ArtistApplicationQueueFilters;
    cursor: ArtistApplicationQueueCursor | null;
    limit: number;
    sort: "submitted_desc" | "submitted_asc";
  }): Promise<
    Omit<AdminArtistApplicationListResponse, "nextCursor"> & {
      nextCursor: ArtistApplicationQueueCursor | null;
    }
  >;
  /** Null for a draft or a missing application. */
  getDetail(id: string): Promise<Omit<AdminArtistApplicationDetail, "reapplyFrom"> | null>;
  /** Sent applications nobody has picked up, for the count beside the nav entry. */
  countNew(): Promise<number>;
}

/** Signed uploads for application images; see the shop media upload handlers. */
export interface ApplicantImageUploads {
  presign(input: { contentType: string; byteSize: number; subjectId: string }): Promise<{
    key: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  }>;
  /** Checks the uploaded bytes; throws when the file is not the image it claimed to be. */
  confirm(key: string): Promise<void>;
  /** Who uploaded the image and whether it is one, so nobody attaches someone else's file. */
  ownerOf(key: string): Promise<{ subjectId: string | null; applicationImage: boolean } | null>;
}

export type Clock = { now(): Date };
