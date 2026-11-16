import { RELEASE_ALERTS_HREF } from "./release-alerts-anchor";

/** What a stop link covers: back in stock requests, or every Shop alert (release alerts). */
export type StopTopic = "back_in_stock" | null;

export type StopCopy = {
  title: string;
  /** The page's own title in the browser. */
  metadataTitle: string;
  invalidBody: string;
  confirmLead: (maskedEmail: string) => string;
  confirmBody: string;
  button: string;
  doneLead: string;
  /** Where the person can ask again, in words. */
  doneBody: (maskedEmail: string) => {
    before: string;
    linkLabel: string;
    linkHref: string;
    after: string;
  };
};

const RELEASES: StopCopy = {
  title: "Stop release alerts",
  metadataTitle: "Stop release alerts",
  invalidBody: "It may be incomplete. Open the link from the release alert email again.",
  confirmLead: (email) => `Stop release alerts to ${email}?`,
  confirmBody: "You will no longer get an email when LAX Shop releases a new edition.",
  button: "Stop alerts",
  doneLead: "Release alerts stopped",
  doneBody: (email) => ({
    before: `We will not send release alerts to ${email}. You can ask again from the `,
    linkLabel: "home page",
    linkHref: RELEASE_ALERTS_HREF,
    after: ".",
  }),
};

const BACK_IN_STOCK: StopCopy = {
  title: "Stop back in stock alerts",
  metadataTitle: "Stop back in stock alerts",
  invalidBody:
    "It may be incomplete. Open the link from the email again, or sign in and stop alerts from Your orders.",
  confirmLead: (email) => `Stop back in stock alerts to ${email}?`,
  confirmBody:
    "Any editions you are waiting for will stop too. Release alerts, if you have them, carry on.",
  button: "Stop alerts",
  doneLead: "Back in stock alerts stopped",
  doneBody: (email) => ({
    before: `We will not send back in stock alerts to ${email}. You can ask again from any sold-out edition. `,
    linkLabel: "Browse editions",
    linkHref: "/artworks",
    after: "",
  }),
};

/** The stop page's wording for what the link covers. One place, so a new topic adds one entry. */
export function stopCopy(topic: StopTopic): StopCopy {
  return topic === "back_in_stock" ? BACK_IN_STOCK : RELEASES;
}
