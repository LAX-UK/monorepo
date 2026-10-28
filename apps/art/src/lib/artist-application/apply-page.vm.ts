import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { MyArtistApplication, MyArtistApplicationState } from "@auction/shop-contracts";
import type { ArtistApplicationResult } from "./artist-application.port";

/** What the apply page shows, decided once from who is visiting and their application. */
export type ApplyPageView =
  | { kind: "sign_in"; loginHref: string; registerHref: string }
  | { kind: "account_disabled"; accountHref: string | null }
  | { kind: "unavailable" }
  /**
   * The form. `application` is null for a first (or a new) application; `question` is the
   * gallery's when it asked for more; `previous` is a declined application the artist may now
   * follow with a new one.
   */
  | {
      kind: "form";
      application: MyArtistApplication | null;
      question: string | null;
      previous: MyArtistApplication | null;
    }
  /** Just sent: the confirmation with the reference. */
  | { kind: "sent"; application: MyArtistApplication }
  | { kind: "status"; application: MyArtistApplication }
  | { kind: "accepted"; application: MyArtistApplication }
  | { kind: "declined"; application: MyArtistApplication; availableFrom: string | null };

export function decideApplyPageView(input: {
  viewer: ArtViewerState;
  state: ArtistApplicationResult<MyArtistApplicationState> | null;
  /** Set on the redirect after sending, to show the confirmation once. */
  justSent: boolean;
  returnPath: string;
}): ApplyPageView {
  const { viewer, state } = input;
  const returnTo = encodeURIComponent(input.returnPath);
  if (viewer.kind === "guest" || state?.kind === "signed_out") {
    return {
      kind: "sign_in",
      loginHref: `/login?returnTo=${returnTo}`,
      registerHref: `/register?returnTo=${returnTo}`,
    };
  }
  if (viewer.kind === "disabled")
    return { kind: "account_disabled", accountHref: viewer.accountHref ?? null };
  if (viewer.kind === "unavailable" || !state || state.kind !== "ok")
    return { kind: "unavailable" };

  const { application, next, availableFrom } = state.value;
  if (!application) return { kind: "form", application: null, question: null, previous: null };
  if (next === "accepted") return { kind: "accepted", application };
  if (application.status === "declined") {
    return next === "start"
      ? { kind: "form", application: null, question: null, previous: application }
      : { kind: "declined", application, availableFrom };
  }
  if (application.editable) {
    return {
      kind: "form",
      application,
      question: application.status === "more_info_needed" ? application.messageToArtist : null,
      previous: null,
    };
  }
  return input.justSent ? { kind: "sent", application } : { kind: "status", application };
}
