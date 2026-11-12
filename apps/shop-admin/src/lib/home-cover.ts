import {
  type AdminHomeCover,
  type AdminHomeCoverIssue,
  HOME_COVER_ALT_MAX_LENGTH,
  HOME_COVER_ISSUE_FIELD_VALUES,
  HOME_COVER_ISSUE_REASON_VALUES,
  type HomeCoverIssueField,
  type HomeCoverIssueReason,
} from "@auction/shop-contracts";

/** The picture and words staff are working on, before they are saved. */
export type HomeCoverDraft = {
  mediaKey: string;
  /** Where the picture can be seen now. */
  imageUrl: string;
  /** Known after an upload or a save; a Shop picture chosen from the list has none until then. */
  width: number | null;
  height: number | null;
  alt: string;
  focal: { x: number; y: number };
};

export type SavedHomeCover = NonNullable<AdminHomeCover["cover"]>;

export const HOME_COVER_COPY = {
  title: "Cover image",
  description:
    "The picture that leads the LAX Shop home. Without one, the home leads with the newest release. Saved changes go live at once.",
  emptyReadOnly: "No cover image is set. The home leads with the newest release.",
  altLabel: "Alt text",
  altHint: "Describes the picture for people who cannot see it.",
  pickerFieldLabel: "From the Shop",
  pickerLabel: "Choose a Shop picture",
  pickerPlaceholder: "Search editions and artists",
  uploadFieldLabel: "From your computer",
  uploadLabel: "Upload a picture",
  pictureLabel: "Picture",
  focalLabel: "Where the subject is",
  focalHint: "Click or drag on the picture. The headline sits on the other side.",
} as const;

/** The draft a saved cover starts from. */
export function draftFromSaved(cover: SavedHomeCover): HomeCoverDraft {
  return {
    mediaKey: cover.mediaKey,
    imageUrl: cover.imageUrl,
    width: cover.width,
    height: cover.height,
    alt: cover.alt,
    focal: cover.focal,
  };
}

/** True when saving would change what is live: another picture, other words or another point. */
export function draftDiffersFromSaved(
  draft: HomeCoverDraft | null,
  saved: SavedHomeCover | null,
): boolean {
  if (!draft || !saved) return draft !== saved;
  return (
    draft.mediaKey !== saved.mediaKey ||
    draft.alt.trim() !== saved.alt ||
    draft.focal.x !== saved.focal.x ||
    draft.focal.y !== saved.focal.y
  );
}

/**
 * True when the draft is exactly the saved cover, so what was measured at save time (where the
 * headline sits, its colour) still describes it.
 */
export function draftIsMeasured(
  draft: HomeCoverDraft | null,
  saved: SavedHomeCover | null,
): boolean {
  return Boolean(draft && saved) && !draftDiffersFromSaved(draft, saved);
}

/** A field's problem, with the field it belongs to. */
export type HomeCoverProblem = { field: HomeCoverIssueField; message: string };

function tooNarrow(width: number | null, minimumWidth: number): string {
  return width !== null
    ? `This picture is ${width} px wide. The cover needs at least ${minimumWidth} px.`
    : `This picture is too small. The cover needs at least ${minimumWidth} px wide.`;
}

const ISSUE_MESSAGE: Record<
  HomeCoverIssueReason,
  (context: { width: number | null; minimumWidth: number }) => string
> = {
  picture_unknown: () => "This picture can't be used. Choose another.",
  picture_unreadable: () => "This picture could not be read. Try another file.",
  picture_too_narrow: ({ width, minimumWidth }) => tooNarrow(width, minimumWidth),
  picture_cannot_carry_type: () =>
    "The headline can't be read on this picture. Choose one with a calmer area on the side the headline sits.",
  alt_missing: () => "Describe the picture in a few words.",
};

/** What is wrong before anything is sent: the words, and a picture known to be too narrow. */
export function homeCoverDraftProblems(
  draft: HomeCoverDraft,
  minimumWidth: number,
): HomeCoverProblem[] {
  const problems: HomeCoverProblem[] = [];
  if (draft.width !== null && draft.width < minimumWidth) {
    problems.push({
      field: "mediaKey",
      message: ISSUE_MESSAGE.picture_too_narrow({ width: draft.width, minimumWidth }),
    });
  }
  if (draft.alt.trim().length === 0) {
    problems.push({
      field: "alt",
      message: ISSUE_MESSAGE.alt_missing({ width: null, minimumWidth }),
    });
  }
  if (draft.alt.length > HOME_COVER_ALT_MAX_LENGTH) {
    problems.push({
      field: "alt",
      message: `Keep the alt text to ${HOME_COVER_ALT_MAX_LENGTH} characters.`,
    });
  }
  return problems;
}

function isIssue(value: unknown): value is AdminHomeCoverIssue {
  if (!value || typeof value !== "object") return false;
  const { field, reason } = value as Record<string, unknown>;
  return (
    (HOME_COVER_ISSUE_FIELD_VALUES as readonly unknown[]).includes(field) &&
    (HOME_COVER_ISSUE_REASON_VALUES as readonly unknown[]).includes(reason)
  );
}

/** The problems shop-api named for a refused save, in the words staff read. */
export function homeCoverIssueProblems(
  issues: unknown[] | undefined,
  context: { width: number | null; minimumWidth: number },
): HomeCoverProblem[] {
  return (issues ?? []).filter(isIssue).map((issue) => ({
    field: issue.field,
    message: ISSUE_MESSAGE[issue.reason](context),
  }));
}

/** Where the headline sits on a measured cover and the colour of its type. */
export function homeCoverPlacementLine(cover: Pick<SavedHomeCover, "side" | "tone">): string {
  return `The headline sits on the ${cover.side}, in ${cover.tone === "light" ? "white" : "dark"} type.`;
}

/** A suggested alt text for a Shop picture, which staff can change. */
export function suggestedAlt(artworkTitle: string, artistName: string): string {
  return `${artworkTitle}, by ${artistName}`;
}
