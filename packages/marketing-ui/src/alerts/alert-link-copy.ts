/** The words of the confirm and stop pages, one entry per product. */
export type AlertLinkCopy = {
  brandName: string;
  confirm: {
    readyTitle: string;
    /** `address` is the masked address the alerts will go to. */
    readyDescription: (address: string) => string;
    button: string;
    doneTitle: string;
    doneDescription: string;
    expiredTitle: string;
    expiredDescription: string;
    invalidTitle: string;
    invalidDescription: string;
    failedTitle: string;
    failedDescription: string;
    retryButton: string;
  };
  stop: {
    readyTitle: string;
    readyDescription: (address: string) => string;
    /** Several topics are on: stop them all, or only the one the person came from. */
    allButton: string;
    allHint: (topics: string) => string;
    topicButton: (topic: string) => string;
    topicHint: string;
    /** One topic only. */
    singleButton: string;
    footnote: string;
    stoppedTitle: string;
    stoppedDescription: string;
    alreadyTitle: string;
    alreadyDescription: string;
    invalidTitle: string;
    invalidDescription: string;
    failedTitle: string;
    failedDescription: string;
  };
  /** Where each ending leads. */
  links: {
    home: { label: string; href: string };
    askAgain: { label: string; href: string };
    afterConfirm: { label: string; href: string };
  };
};

export const ALERT_LINK_COPY = {
  bid: {
    brandName: "LAX Bid",
    confirm: {
      readyTitle: "Confirm sale alerts",
      readyDescription: (address) =>
        `We'll email ${address} when LAX Bid announces a new sale. At most one email a day.`,
      button: "Confirm sale alerts",
      doneTitle: "Sale alerts are on",
      doneDescription:
        "Your first email comes at 08:00 after the next sale is announced. Every email has a link to stop.",
      expiredTitle: "This link has expired",
      expiredDescription:
        "Confirmation links work for 48 hours. Ask again and we'll send a new one.",
      invalidTitle: "This link doesn't work",
      invalidDescription:
        "It may have been replaced by a newer email. Ask for alerts again to get a new one.",
      failedTitle: "We couldn't confirm just now",
      failedDescription: "Nothing has changed. Try again in a moment.",
      retryButton: "Try again",
    },
    stop: {
      readyTitle: "Stop LAX Bid alert emails?",
      readyDescription: (address) => `To ${address}`,
      allButton: "Stop all LAX Bid alerts",
      allHint: (topics) => topics,
      topicButton: (topic) => `Only stop ${topic} emails`,
      topicHint: "The topic of the email you came from",
      singleButton: "Stop sale alerts",
      footnote: "In-app alerts and emails about bids, invoices and payments are not affected.",
      stoppedTitle: "Sale alerts stopped",
      stoppedDescription:
        "We won't email this address about new sales unless you ask again. Emails about bids, invoices and payments are not affected.",
      alreadyTitle: "These emails are already off",
      alreadyDescription: "Nothing more will be sent about sale alerts.",
      invalidTitle: "This link doesn't work",
      invalidDescription:
        "It may be incomplete. Use the stop link in the latest alert email, or contact us and we'll remove you.",
      failedTitle: "We couldn't stop these emails just now",
      failedDescription: "Nothing has changed. Try again in a moment.",
    },
    links: {
      home: { label: "Back to LAX Bid", href: "/" },
      askAgain: { label: "Ask again", href: "/#alerts" },
      afterConfirm: { label: "See upcoming sales", href: "/sales" },
    },
  },
} as const satisfies Record<string, AlertLinkCopy>;

export type AlertLinkProduct = keyof typeof ALERT_LINK_COPY;
