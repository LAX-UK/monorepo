import {
  ARTIST_APPLICATION_SEARCH_MAX_LENGTH,
  type AdminArtistApplicationDetail,
  type AdminArtistApplicationEvent,
  type ArtistApplicationReviewer,
  type ArtistApplicationWorkView,
  type CatalogueImageResolver,
} from "@auction/shop-contracts";
import {
  type ArtistApplicationAction,
  type ArtistApplicationStatus,
  availableArtistApplicationActions,
} from "@auction/shop-domain";
import type { ImageGalleryItem, StaffStatusTone } from "@auction/staff-ui";
import { enquiryStaffName } from "./enquiry-inbox.vm";
import { type RawSearchParams, singleParam } from "./list-url-state";
import { type WorkListState, defineWorkList } from "./work-list.vm";

export const ARTIST_APPLICATION_LIST_PATH = "/artist-applications";

/*
 * The applications queue: built-in views by where an application stands (new, in review,
 * waiting on the artist, decided), search, an assignee filter and the sort. Each view counts the
 * API's figure of the same name, so the tabs add up under the same search.
 */
export const artistApplicationsList = defineWorkList({
  path: ARTIST_APPLICATION_LIST_PATH,
  views: [
    { id: "new", label: "New", api: { view: "new" }, statuses: ["new"] },
    { id: "in_review", label: "In review", api: { view: "in_review" }, statuses: ["in_review"] },
    { id: "waiting", label: "Waiting on artist", api: { view: "waiting" }, statuses: ["waiting"] },
    { id: "decided", label: "Decided", api: { view: "decided" }, statuses: ["decided"] },
    { id: "all", label: "All", api: { view: "all" }, statuses: ["all"] },
  ],
  defaultView: "new",
  filters: { assignee: ["me", "unassigned"] },
  sorts: { submitted: { asc: "submitted_asc", desc: "submitted_desc" } },
  defaultSort: "submitted_desc",
  panelParam: "application",
  searchMaxLength: ARTIST_APPLICATION_SEARCH_MAX_LENGTH,
});

export type ArtistApplicationsListState = WorkListState<"assignee">;

const ASSIGNEE_SUBJECT_MAX_LENGTH = 200;

/** The queue's URL state; the reviewer filter also takes a colleague's identity subject. */
export function parseArtistApplicationsState(params: RawSearchParams): ArtistApplicationsListState {
  const state = artistApplicationsList.parse(params);
  const raw = singleParam(params.assignee);
  if (!raw || state.filters.assignee || raw.length > ASSIGNEE_SUBJECT_MAX_LENGTH) return state;
  return { ...state, filters: { ...state.filters, assignee: raw } };
}

export function artistApplicationPath(id: string): string {
  return `${ARTIST_APPLICATION_LIST_PATH}/${id}`;
}

/** The name staff see: the artist's name, else the reference, so no row reads blank. */
export function applicationTitle(item: { artistName: string | null; reference: string }): string {
  return item.artistName?.trim() || item.reference;
}

export function reviewerName(person: ArtistApplicationReviewer | null): string {
  return person ? enquiryStaffName(person) : "Unassigned";
}

const WORK_KIND_LABEL = { original: "Original", edition: "Edition" } as const;

/** One work's facts for its caption: "2024 · Oil on linen · 60 × 80 cm". */
export function workCaption(
  work: Pick<ArtistApplicationWorkView, "year" | "medium" | "size">,
): string {
  return [work.year?.toString(), work.medium, work.size].filter(Boolean).join(" · ");
}

/** The works as gallery items, each image read through the staff catalogue image resolver. */
export function workGalleryItems(
  works: readonly ArtistApplicationWorkView[],
  resolveImage: CatalogueImageResolver,
): ImageGalleryItem[] {
  return works.map((work, index) => {
    const title = work.title?.trim() || `Untitled work ${index + 1}`;
    const caption = workCaption(work);
    return {
      id: work.mediaKey,
      src: resolveImage(work.imageUrl) ?? work.imageUrl,
      alt: title,
      title,
      ...(caption ? { caption } : {}),
      ...(work.kind ? { badge: WORK_KIND_LABEL[work.kind] } : {}),
    };
  });
}

/** The staff actions open in this status, from the domain's transition table. */
export function staffActionsFor(
  status: ArtistApplicationStatus,
): ReadonlySet<ArtistApplicationAction> {
  return new Set(availableArtistApplicationActions(status, "staff"));
}

/** A lax.art address for the new artist: lower-case words joined by hyphens. */
export function suggestArtistSlug(name: string | null): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const ARTIST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type EventPresentation = {
  title: (event: AdminArtistApplicationEvent) => string;
  tone: StaffStatusTone;
};

/** Each history event as a sentence, in one table. */
const EVENT_PRESENTATION: Record<string, EventPresentation> = {
  submit: { title: () => "Application sent", tone: "info" },
  resubmit: { title: () => "The artist answered and sent it back", tone: "info" },
  assign: {
    title: (event) =>
      event.assignee ? `Assigned to ${enquiryStaffName(event.assignee)}` : "Reviewer removed",
    tone: "neutral",
  },
  request_info: { title: () => "Asked the artist for more information", tone: "warning" },
  accept: { title: () => "Accepted", tone: "success" },
  decline: { title: () => "Declined", tone: "neutral" },
};

export function historyEvents(detail: Pick<AdminArtistApplicationDetail, "events" | "artistName">) {
  return [...detail.events].reverse().map((event) => {
    const presentation = EVENT_PRESENTATION[event.action] ?? {
      title: () => event.action.replace(/_/g, " "),
      tone: "neutral" as const,
    };
    return {
      id: event.id,
      title: presentation.title(event),
      at: event.createdAt,
      actor:
        event.actor.kind === "applicant"
          ? (detail.artistName?.trim() ?? "The artist")
          : event.actor.person
            ? enquiryStaffName(event.actor.person)
            : "Staff",
      ...(event.message ? { detail: event.message } : {}),
      tone: presentation.tone,
    };
  });
}
