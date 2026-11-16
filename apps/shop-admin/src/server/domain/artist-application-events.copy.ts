import type { ArtistApplicationAction } from "@auction/shop-domain";

/** Each artist-application history event as a sentence; `assignee` is the reviewer's name, if any. */
export const ARTIST_APPLICATION_EVENT_TITLES: Record<
  ArtistApplicationAction,
  (assignee: string | null) => string
> = {
  submit: () => "Application sent",
  resubmit: () => "The artist answered and sent it back",
  assign: (assignee) => (assignee ? `Assigned to ${assignee}` : "Reviewer removed"),
  request_info: () => "Asked the artist for more information",
  accept: () => "Accepted",
  decline: () => "Declined",
};
