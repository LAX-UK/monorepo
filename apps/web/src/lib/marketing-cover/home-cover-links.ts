import type { BidCoverLinks } from "./bid-cover.adapter";

/** Where the Bid home cover's actions lead. */
export const HOME_COVER_LINKS: BidCoverLinks = {
  register: "/register",
  bids: "/account/bids",
  sell: "/sell",
  contact: "/contact",
};

/** Where the between-seasons email field posts. It works without script and redirects back home. */
export const HOME_COVER_NOTIFY_ACTION = "/api/newsletter/notify";

/** Names the cover's region for screen readers. */
export const HOME_COVER_LABEL = "Featured sales";
