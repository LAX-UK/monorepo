/**
 * The words of Bid settings' "Where alerts reach you" table: each row's name and line, and why an
 * email cannot be switched off. The rows themselves (which switches they hold) are in
 * `alert-matrix.ts`.
 */
export const ALERT_ROW_COPY = {
  outbid: { label: "Outbid", description: "When someone bids over you" },
  closing: { label: "Lot closing soon", description: "Before a lot you bid on or watch closes" },
  won: { label: "You won a lot", description: "With the invoice and how to pay" },
  lost: {
    label: "A lot sold to someone else",
    description: "When a lot you bid on closes without you",
  },
  payments: { label: "Payments", description: "Invoices, receipts and reminders to pay" },
  consignments: { label: "Consignment updates", description: "Review, agreement and sale steps" },
  "sale-ended": {
    label: "Your work's sale ended",
    description: "When a lot you sell closes, sold or not",
  },
  watching: { label: "Lots you watch", description: "When a watched lot opens or has news" },
  identity: {
    label: "Identity check",
    description: "When your identity check is approved or declined",
  },
  registrations: {
    label: "Registrations and limits",
    description: "When you can bid in a sale, or staff change a limit",
  },
  "new-sales": { label: "New sales", description: "When LAX Bid announces a sale" },
  artists: { label: "Artists you follow", description: "New lots that match each artist's alert" },
  searches: { label: "Saved searches", description: "New lots that match a search with email on" },
} as const;

/** Why an email that records a decision about you stays on. */
export const ALWAYS_EMAILED_REASON = {
  identity:
    "Always emailed: the result of your identity check, with what to do next if it was declined.",
  registrations: "Always emailed: whether you can bid in a sale, and the limit you bid under.",
} as const;
