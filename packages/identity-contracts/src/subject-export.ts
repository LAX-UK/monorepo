import { z } from "zod";
import { INTERNAL_IDENTITY_ROUTE_PREFIX } from "./deletion-eligibility.js";

/**
 * "Download my data": one person asks LAX Account for a copy of what LAX holds about them.
 * Identity runs the request, each product answers for its own data through an internal route,
 * and the worker assembles the file. Everything the parties share is defined here, so the
 * README that ships with the copy is generated from the same descriptions the products validate
 * against and cannot drift from them.
 */

/** Products that hold personal data and so answer an export. lax.art is part of `shop`. */
export const SUBJECT_EXPORT_PRODUCTS = ["account", "bid", "shop"] as const;

export type SubjectExportProduct = (typeof SUBJECT_EXPORT_PRODUCTS)[number];

/** Machine-credential scope for the export routes. Separate from deletion eligibility, so a leaked eligibility credential cannot pull data. */
export const SUBJECT_EXPORT_MACHINE_SCOPE = "subject_export";

// Limits ------------------------------------------------------------------------------------

/** At most this many requests in any rolling window of {@link SUBJECT_EXPORT_RATE_LIMIT_WINDOW_DAYS}. */
export const SUBJECT_EXPORT_MAX_REQUESTS_PER_WINDOW = 4;
export const SUBJECT_EXPORT_RATE_LIMIT_WINDOW_DAYS = 30;
/** A person has one open request at a time. */
export const SUBJECT_EXPORT_MAX_OPEN_REQUESTS = 1;
/** How long a finished copy stays downloadable. */
export const SUBJECT_EXPORT_RETENTION_DAYS = 7;
/** How long one signed download link works. */
export const SUBJECT_EXPORT_DOWNLOAD_LINK_SECONDS = 300;
/** The ZIP size cap; files beyond it are listed in the JSON as "ask us" and the rest still ships. */
export const SUBJECT_EXPORT_MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
/** The most one category page may carry on the wire. */
export const SUBJECT_EXPORT_MAX_PAGE_BYTES = 1024 * 1024;
/** A product that does not answer is retried for this long, then the request becomes `delayed`. */
export const SUBJECT_EXPORT_PRODUCT_RETRY_HOURS = 72;
/** Records a product may put on one page, a ceiling next to the byte cap. */
export const SUBJECT_EXPORT_MAX_PAGE_RECORDS = 500;

/**
 * `months` calendar months after `at`, counted as the ICO counts them: the same date, or the
 * month's last day when that date does not exist (31 January plus one month is 28 or 29
 * February). Computed in UTC and keeps the time of day.
 */
export function addUtcMonthsClamped(at: Date, months: number): Date {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(at.getUTCDate(), lastDayOfTarget);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      at.getUTCHours(),
      at.getUTCMinutes(),
      at.getUTCSeconds(),
      at.getUTCMilliseconds(),
    ),
  );
}

/**
 * The legal due date: one calendar month after the request, counted as the ICO counts it. It is
 * the same date next month, or the month's last day when that date does not exist (31 January
 * is due 28 or 29 February). Computed in UTC and keeps the time of day.
 */
export function subjectExportDueAt(requestedAt: Date): Date {
  return addUtcMonthsClamped(requestedAt, 1);
}

// Paths -------------------------------------------------------------------------------------

/** Issuer routes LAX Account calls (under the Better Auth base path). Create and download need a recent sign-in. */
export const ACCOUNT_DATA_EXPORTS_PATH = "/lax/data-exports";
export const ACCOUNT_DATA_EXPORTS_CURRENT_PATH = "/lax/data-exports/current";
export const ACCOUNT_DATA_EXPORTS_DOWNLOAD_PATH = "/lax/data-exports/download";
export const ACCOUNT_DATA_EXPORTS_DELETE_PATH = "/lax/data-exports/delete";

/** Subroutes every product serves under the internal Identity prefix, with the subject as parameter. */
export const SUBJECT_EXPORT_MANIFEST_SUBROUTE = "/subjects/:subjectId/export";
export const SUBJECT_EXPORT_PAGE_SUBROUTE = "/subjects/:subjectId/export/:category";
/** The route the worker calls on Identity to report progress. */
export const SUBJECT_EXPORT_PROGRESS_SUBROUTE = "/subject-exports/:exportId/progress";
/** Stored copies Identity has asked to have deleted and the worker has not yet removed. */
export const SUBJECT_EXPORT_PURGE_PENDING_SUBROUTE = "/subject-exports/purge-pending";
/** The worker confirms one stored copy is gone. */
export const SUBJECT_EXPORT_PURGED_SUBROUTE = "/subject-exports/:exportId/purged";

export function subjectExportManifestPath(subjectId: string): string {
  return `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_MANIFEST_SUBROUTE.replace(
    ":subjectId",
    encodeURIComponent(subjectId),
  )}`;
}

/** The page route for one category; the cursor, when there is one, goes in the query string. */
export function subjectExportPagePath(
  subjectId: string,
  category: string,
  cursor?: string | null,
): string {
  const path = `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_PAGE_SUBROUTE.replace(
    ":subjectId",
    encodeURIComponent(subjectId),
  ).replace(":category", encodeURIComponent(category))}`;
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

export function subjectExportProgressPath(exportId: string): string {
  return `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_PROGRESS_SUBROUTE.replace(
    ":exportId",
    encodeURIComponent(exportId),
  )}`;
}

export function subjectExportPurgePendingPath(limit?: number): string {
  const path = `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_PURGE_PENDING_SUBROUTE}`;
  return limit === undefined ? path : `${path}?limit=${limit}`;
}

export function subjectExportPurgedPath(exportId: string): string {
  return `${INTERNAL_IDENTITY_ROUTE_PREFIX}${SUBJECT_EXPORT_PURGED_SUBROUTE.replace(
    ":exportId",
    encodeURIComponent(exportId),
  )}`;
}

// Shared value shapes -----------------------------------------------------------------------

/** Dates are ISO 8601 in UTC; the readable summary shows London time. */
export const subjectExportDateSchema = z.string().datetime();

/** Money is minor units plus a currency code, never a float. */
export const subjectExportMoneySchema = z.object({
  minor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

/**
 * Where a record came from, which splits the portability right from the access right:
 * `provided` (they typed or uploaded it), `observed` (their use produced it), `made_by_us`
 * (a fact LAX set about them, such as an approval status).
 */
export const SUBJECT_EXPORT_ORIGINS = ["provided", "observed", "made_by_us"] as const;
export const subjectExportOriginSchema = z.enum(SUBJECT_EXPORT_ORIGINS);
export type SubjectExportOrigin = z.infer<typeof subjectExportOriginSchema>;

/**
 * A file a product holds for the person, given as a short-lived signed link from the product's
 * own storage. The worker fetches it into the download and replaces it with a path inside the ZIP.
 */
export const subjectExportFileRefSchema = z.object({
  url: z.string().url(),
  fileName: z.string().min(1),
  contentType: z.string().min(1).nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  expiresAt: z.string().datetime(),
});
export type SubjectExportFileRef = z.infer<typeof subjectExportFileRefSchema>;

/** A record is free-form per category, but always has an id and an origin. */
export const subjectExportRecordSchema = z
  .object({ id: z.string().min(1), origin: subjectExportOriginSchema })
  .passthrough();
export type SubjectExportRecord = z.infer<typeof subjectExportRecordSchema>;

// Categories --------------------------------------------------------------------------------

export type SubjectExportFieldDescription = {
  readonly name: string;
  readonly description: string;
};

export type SubjectExportCategoryDefinition = {
  /** Stable id; also the JSON file name without its extension. */
  readonly id: string;
  /** Version of this category's record shape; the schema name carries it. */
  readonly schemaVersion: number;
  readonly title: string;
  /** One sentence for the README and the summary. */
  readonly description: string;
  readonly origins: readonly SubjectExportOrigin[];
  /** The record fields beyond `id` and `origin`, one sentence each. */
  readonly fields: readonly SubjectExportFieldDescription[];
};

const f = (name: string, description: string): SubjectExportFieldDescription => ({
  name,
  description,
});

const category = (
  id: string,
  title: string,
  origins: readonly SubjectExportOrigin[],
  description: string,
  fields: readonly SubjectExportFieldDescription[],
): SubjectExportCategoryDefinition => ({
  id,
  schemaVersion: 1,
  title,
  description,
  origins,
  fields,
});

const ACCOUNT_CATEGORIES = [
  category(
    "profile",
    "Profile",
    ["provided"],
    "Your name, display name, when you joined, your account status and your language and theme choices.",
    [
      f("name", "Your full name as held on your account."),
      f("displayName", "The name shown to others, where you set one."),
      f("joinedAt", "When your account was created."),
      f("status", "Whether the account is active, disabled or pending deletion."),
      f("deletionRequestedAt", "When you asked for deletion, if you did; null otherwise."),
      f("language", "Your chosen language."),
      f("theme", "Your chosen colour theme: light, dark or system."),
      f("image", "The address of your profile picture, or null."),
    ],
  ),
  category(
    "contact",
    "Contact",
    ["provided"],
    "Your email address, earlier email addresses, any phone number still held, and when each was verified.",
    [
      f("email", "Your current email address."),
      f("emailVerified", "Whether you have confirmed the current email address."),
      f("emailVerifiedAt", "When you confirmed the current email address, where we kept the date."),
      f("previousEmails", "Earlier email addresses, each with the date it changed."),
      f("phone", "The phone number still held, or null."),
      f("phoneVerified", "Whether you have confirmed the phone number."),
      f("phoneVerifiedAt", "When you confirmed the phone number, or null."),
    ],
  ),
  category(
    "addresses",
    "Addresses",
    ["provided"],
    "Every address saved in your shared LAX address book, with its label and defaults.",
    [
      f("label", "The name you gave the address."),
      f("recipient", "The name on the address."),
      f("phone", "The phone number saved with the address for the courier, or null."),
      f("lines", "The street address lines."),
      f("city", "The town or city."),
      f("region", "The county, state or region, where given."),
      f("postalCode", "The postcode or ZIP code."),
      f("country", "The two-letter country code."),
      f("isDefaultDelivery", "Whether it is your default delivery address."),
      f("isDefaultBilling", "Whether it is your default billing address."),
      f("createdAt", "When you saved the address."),
      f("updatedAt", "When you last changed it."),
    ],
  ),
  category(
    "sign-in-and-security",
    "Sign-in and security",
    ["observed"],
    "Your sessions, known devices, sign-in methods, two-step status and the security notices we sent you. Secrets are never included.",
    [
      f(
        "kind",
        "What the record describes: session, device, sign-in method, two-step, security notice or security event.",
      ),
      f("device", "The device or browser."),
      f("ipAddress", "The IP address the activity came from, for sessions."),
      f("approximateLocation", "The approximate place derived from the IP address."),
      f("startedAt", "When the session or activity started."),
      f("endedAt", "When the session ended, or null if it is still active."),
      f("method", "The sign-in method: password, passkey or a social provider."),
      f(
        "passwordSet",
        "Whether a password is set on your account; the password itself is never included.",
      ),
      f(
        "methodName",
        "The name you gave a passkey, or the provider and email of a social sign-in.",
      ),
      f("twoStepEnabled", "Whether two-step verification is on."),
      f("changedAt", "When the method or setting last changed."),
      f("noticeType", "The kind of security notice we sent or security event that happened."),
      f("sentAt", "When the notice was sent."),
    ],
  ),
  category(
    "consents",
    "Consents",
    ["provided"],
    "The terms you accepted, the privacy notice version you saw, stored cookie choices and the LAX products you have allowed to sign you in.",
    [
      f("kind", "The type of consent: terms, privacy notice, cookies or product access."),
      f("version", "The version of the document or policy."),
      f("acceptedAt", "When you accepted or chose."),
      f("choice", "What you chose, where there is a choice."),
      f("product", "The LAX product you granted access to, for product access."),
      f("scopes", "What you allowed that product to read, for product access."),
    ],
  ),
  category(
    "requests",
    "Requests",
    ["observed"],
    "Your earlier data downloads and deletion requests: dates and outcomes only, never the earlier files.",
    [
      f("kind", "Whether the request was a data download or a deletion."),
      f("requestedAt", "When you made the request."),
      f("outcome", "How it ended: completed, expired, deleted by you, cancelled or failed."),
      f("completedAt", "When it ended, or null while open."),
    ],
  ),
] as const;

const BID_CATEGORIES = [
  category(
    "bidder-profile",
    "Bidder profile",
    ["provided"],
    "Your bidder profile, paddle numbers, chosen interests, onboarding answers and buyer-agent authorisations.",
    [
      f("displayName", "The name shown on your bidder profile."),
      f("paddles", "Your paddle numbers, each with the sale it was issued for."),
      f("interests", "The interests you chose."),
      f("onboardingAnswers", "What you told us when you set up bidding."),
      f("agentAuthorisations", "Buyer-agent authorisations you gave or hold, with their dates."),
    ],
  ),
  category(
    "registrations",
    "Registrations",
    ["provided", "made_by_us"],
    "Your sale registrations and their status, telephone-bid bookings, and event RSVPs and check-ins.",
    [
      f("kind", "Sale registration, telephone-bid booking or event RSVP."),
      f("sale", "The sale or event, with its title and public link."),
      f(
        "status",
        "Approved, pending or not approved; a refusal shows the public reason category only.",
      ),
      f("registeredAt", "When you registered or booked."),
      f("decidedAt", "When LAX made its decision, or null."),
      f("checkedInAt", "When you were checked in at an event, or null."),
    ],
  ),
  category(
    "bids",
    "Bids",
    ["provided"],
    "Every bid and maximum bid you placed. Other bidders do not appear.",
    [
      f("placedAt", "When the bid was placed."),
      f("sale", "The sale, with its title and public link."),
      f("lot", "The lot number and title."),
      f("amount", "The bid amount as minor units and currency."),
      f("kind", "Whether it was a live bid or a maximum bid."),
      f("channel", "How it was placed: online, telephone, room or agent."),
      f("outcome", "How it ended: leading, outbid, won, withdrawn, void or pending."),
    ],
  ),
  category(
    "purchases",
    "Purchases",
    ["observed"],
    "The lots you won, with hammer price, premium, fees, tax, delivery or collection, fulfilment status and any dispute you raised.",
    [
      f("lot", "The lot, with its sale, number and title."),
      f("hammer", "The hammer price as minor units and currency."),
      f("premium", "The buyer's premium."),
      f("fees", "Other fees charged."),
      f("tax", "Tax charged."),
      f("total", "The total payable."),
      f("fulfilment", "Delivery or collection method and its current status."),
      f("disputes", "Disputes you raised, with their dates and outcomes."),
      f("purchasedAt", "When the sale was confirmed."),
    ],
  ),
  category(
    "invoices",
    "Invoices",
    ["observed"],
    "Your invoices as data, with a link to the PDF file included in the download.",
    [
      f("number", "The invoice number."),
      f("issuedAt", "When it was issued."),
      f("dueAt", "When payment was due."),
      f("lines", "The invoice lines, each with a description and amount."),
      f("total", "The invoice total as minor units and currency."),
      f("status", "Whether the invoice is open, paid or void."),
      f("file", "The path of the PDF within the download, or null where it is not included."),
    ],
  ),
  category(
    "payments",
    "Payments",
    ["observed"],
    "Payments and refunds on your account, with card brand and last four digits only.",
    [
      f("invoiceId", "The invoice the payment relates to."),
      f("amount", "The amount as minor units and currency."),
      f("kind", "Whether it is a payment or a refund."),
      f(
        "method",
        "The payment method, with card brand and last four digits where a card was used.",
      ),
      f("status", "The payment status."),
      f("occurredAt", "When the payment or refund happened."),
    ],
  ),
  category(
    "consignments",
    "Consignments",
    ["provided", "observed"],
    "Works you submitted, agreements you signed, estimates and reserves agreed with you, sale results, unsold choices, payouts and statements.",
    [
      f("kind", "A submitted work, or a payout and statement issued to you."),
      f("title", "The title of the work you submitted."),
      f("description", "Your description of the work."),
      f("photos", "The photos you uploaded, as paths within the download."),
      f("submittedAt", "When you submitted it."),
      f("agreements", "Agreements you signed, with their dates."),
      f("estimate", "The estimate agreed with you, as minor units and currency."),
      f("reserve", "The reserve agreed with you, as minor units and currency."),
      f("result", "The sale result, including the hammer price where sold."),
      f("unsoldChoice", "What you chose for the work if it did not sell."),
      f("payouts", "Payouts and statements issued to you."),
    ],
  ),
  category(
    "messages",
    "Messages",
    ["provided"],
    "Your consignment and condition-report conversations: your messages and LAX's replies.",
    [
      f("threadId", "The conversation the message belongs to."),
      f("subject", "What the conversation is about."),
      f("direction", "Whether you sent the message or LAX did."),
      f("body", "The text of the message."),
      f("staffFirstName", "The first name of the LAX staff member who replied."),
      f("sentAt", "When the message was sent."),
    ],
  ),
  category(
    "watchlist-and-alerts",
    "Watchlist and alerts",
    ["provided"],
    "Lots you watch, sales and artists you follow, saved searches and reminders.",
    [
      f("kind", "Watched lot, followed sale, followed artist, saved search or reminder."),
      f("target", "What it points at, with its title and public link."),
      f("query", "The search terms, for a saved search."),
      f("notifyByEmail", "Whether a saved search emails you."),
      f("reminder", "When a reminder fires relative to the sale or close, such as the day before."),
      f("note", "The note you added to a reminder."),
      f("remindAt", "When the reminder fires, where set."),
      f("createdAt", "When you added it."),
    ],
  ),
  category(
    "notifications",
    "Notifications",
    ["observed", "provided"],
    "Your notification history and preferences, push subscriptions by device label, and mutes. It lists notices; it holds no email bodies.",
    [
      f("kind", "Notification, preference, push subscription or mute."),
      f("title", "The notification title."),
      f("sentAt", "When it was sent."),
      f("read", "Whether you have read it."),
      f("channel", "The channel it applies to: email, push or in-app."),
      f("enabled", "Whether the preference is on."),
      f("deviceLabel", "The device label of a push subscription."),
    ],
  ),
  category(
    "marketing",
    "Marketing",
    ["provided", "observed"],
    "Your marketing consent and its history, category interests, and the campaign attribution LAX recorded about your visits.",
    [
      f("kind", "Consent, interest or attribution."),
      f("granted", "Whether consent was given."),
      f("changedAt", "When the consent changed."),
      f("source", "Where the consent was given."),
      f("interest", "The category you are interested in."),
      f("campaign", "The campaign or source recorded for a visit."),
      f("medium", "The marketing medium recorded for a visit, such as email."),
      f("landingPath", "The page you first arrived on, for a recorded visit."),
    ],
  ),
  category(
    "verification",
    "Verification",
    ["provided", "made_by_us"],
    "The identity, address and source-of-funds documents you supplied and the plain outcome: verified, date and expiry. No screening or risk assessment is included.",
    [
      f("documentType", "Identity, proof of address or source of funds."),
      f("file", "The path of the document you uploaded within the download."),
      f("uploadedAt", "When you uploaded it."),
      f("outcome", "Verified, not verified or pending."),
      f("verifiedAt", "When verification was completed, or null."),
      f("expiresAt", "When the verification expires, or null."),
    ],
  ),
  category(
    "organisations",
    "Organisations",
    ["provided", "observed"],
    "Organisations you belong or belonged to, your role and dates, invitations, and what you did personally on their behalf. The organisation's own records are not included.",
    [
      f("kind", "Membership, invitation or action."),
      f("organisation", "The organisation's name."),
      f("role", "Your role in it."),
      f("joinedAt", "When you joined."),
      f("leftAt", "When you left, or null."),
      f("invitedBy", "Who invited you, described by role such as an owner."),
      f(
        "invitation",
        "An invitation you sent or received, with its direction, role, dates and outcome.",
      ),
      f(
        "action",
        "Something you did personally on behalf of the organisation, marked with its name.",
      ),
    ],
  ),
] as const;

const SHOP_CATEGORIES = [
  category(
    "shop-profile",
    "Shop profile",
    ["provided"],
    "Your Shop profile and interface preferences.",
    [
      f("displayName", "The name on your Shop profile."),
      f("email", "The email address on your Shop profile."),
      f("createdAt", "When the profile was created."),
    ],
  ),
  category(
    "orders",
    "Orders",
    ["provided", "observed"],
    "Your orders with their lines, delivery address used, status history, returns and cancellations. Guest orders appear once linked to your account.",
    [
      f("kind", "An order placed online, or an original work sold to you on lax.art."),
      f("reference", "The order reference to quote when you contact us."),
      f("site", "Whether the order came from LAX Shop or lax.art."),
      f("placedAt", "When the order was placed."),
      f("lines", "The works ordered, each with edition, number and price."),
      f("total", "The order total as minor units and currency."),
      f("deliveryAddress", "The delivery address used, or a note that it was erased."),
      f("fulfilment", "How the order is delivered or collected, with carrier and tracking number."),
      f("status", "The current order status."),
      f("statusHistory", "Each status change with its date."),
      f("returns", "Returns and cancellations, with their dates and outcomes."),
    ],
  ),
  category(
    "invoices",
    "Invoices",
    ["observed"],
    "Your Shop invoices as data, with a link to the PDF file included in the download.",
    [
      f("number", "The invoice number."),
      f("orderId", "The order it relates to."),
      f("orderReference", "The reference of the order it relates to."),
      f("issuedAt", "When it was issued."),
      f("total", "The invoice total as minor units and currency."),
      f("status", "Whether the invoice is open, paid or void."),
      f("file", "The path of the PDF within the download, or null where it is not included."),
    ],
  ),
  category(
    "payments",
    "Payments",
    ["observed"],
    "Payments and refunds on your Shop orders, with card brand and last four digits only.",
    [
      f("orderId", "The order the payment relates to."),
      f("orderReference", "The reference of the order the payment relates to."),
      f("amount", "The amount as minor units and currency."),
      f("kind", "Whether it is a payment or a refund."),
      f(
        "method",
        "The payment method, with card brand and last four digits where a card was used.",
      ),
      f("status", "The payment status."),
      f("occurredAt", "When the payment or refund happened."),
    ],
  ),
  category("basket", "Basket", ["observed"], "The works currently in your basket.", [
    f("work", "The work, with its title and public link."),
    f("edition", "The edition and number."),
    f("quantity", "How many you added."),
    f("price", "The price as minor units and currency."),
    f("addedAt", "When you added it."),
  ]),
  category(
    "enquiries",
    "Enquiries",
    ["provided"],
    "Enquiries you made on LAX Shop and lax.art. Replies were sent by email and are not stored with the enquiry.",
    [
      f("reference", "The enquiry reference to quote when you contact us."),
      f("site", "Whether the enquiry came from LAX Shop or lax.art."),
      f("topic", "What the enquiry was about, for an enquiry not tied to one work."),
      f("work", "The work the enquiry was about."),
      f("message", "Your message, or a note that it was erased."),
      f("contact", "The name, email and phone you gave with the enquiry."),
      f("status", "Whether the enquiry is open or closed."),
      f("sentAt", "When you sent the enquiry."),
    ],
  ),
  category(
    "saved-works",
    "Saved works",
    ["provided"],
    "Works and artists you saved or follow, and alerts you asked for when an edition becomes available.",
    [
      f("kind", "Saved work, followed artist or availability alert."),
      f("target", "What it points at, with its title and public link."),
      f("savedAt", "When you saved it."),
    ],
  ),
  category(
    "selling",
    "Selling",
    ["provided", "made_by_us"],
    "Artist applications and sale-authority requests you made, and their status. Present only if you applied as an artist.",
    [
      f("kind", "Artist application or sale-authority request."),
      f("submittedAt", "When you submitted it."),
      f("details", "What you told us in the application."),
      f("status", "The current status."),
      f("decidedAt", "When LAX decided, or null."),
    ],
  ),
  category(
    "notifications-and-marketing",
    "Notifications and marketing",
    ["observed", "provided"],
    "Emails we sent you by template and date, your newsletter consent and its history, and any email suppression after you unsubscribed.",
    [
      f("kind", "Email sent, consent or suppression."),
      f("template", "The kind of email that was sent."),
      f("sentAt", "When it was sent."),
      f("granted", "Whether newsletter consent was given."),
      f("source", "Where the newsletter consent was given."),
      f("changedAt", "When the consent or suppression changed."),
      f("suppressed", "Whether we are blocked from emailing you."),
    ],
  ),
] as const;

/** Every category each product serves, in the order they appear in the download. */
export const SUBJECT_EXPORT_CATEGORIES: {
  readonly [P in SubjectExportProduct]: readonly SubjectExportCategoryDefinition[];
} = {
  account: ACCOUNT_CATEGORIES,
  bid: BID_CATEGORIES,
  shop: SHOP_CATEGORIES,
};

export function subjectExportCategoryIds(product: SubjectExportProduct): readonly string[] {
  return SUBJECT_EXPORT_CATEGORIES[product].map((entry) => entry.id);
}

export function findSubjectExportCategory(
  product: SubjectExportProduct,
  categoryId: string,
): SubjectExportCategoryDefinition | undefined {
  return SUBJECT_EXPORT_CATEGORIES[product].find((entry) => entry.id === categoryId);
}

/**
 * The company that answers for a product's data, by id. The registered names live in
 * @auction/branding (`LEGAL_ENTITIES`), which renderers use to print them; this package stays
 * free of company names so the Identity closure needs no branding dependency.
 */
export type SubjectExportControllerId = "london-auction-xchange" | "london-art-exchange";

/** Who answers for each product's data, and how the product is named to the person (D13). */
export const SUBJECT_EXPORT_PRODUCT_INFO: {
  readonly [P in SubjectExportProduct]: {
    readonly name: string;
    readonly controllers: readonly SubjectExportControllerId[];
  };
} = {
  account: { name: "LAX Account", controllers: ["london-auction-xchange", "london-art-exchange"] },
  bid: { name: "LAX Bid", controllers: ["london-auction-xchange"] },
  shop: { name: "LAX Shop and lax.art", controllers: ["london-art-exchange"] },
};

/** The versioned schema name written into every file, e.g. `lax.subject-export/bid/bids@1`. */
export function subjectExportSchemaName(
  product: SubjectExportProduct,
  categoryId: string,
  schemaVersion = 1,
): string {
  return `lax.subject-export/${product}/${categoryId}@${schemaVersion}`;
}

// Product wire shapes -----------------------------------------------------------------------

const productSchema = z.enum(SUBJECT_EXPORT_PRODUCTS);

/** What a product answers on `GET /internal/identity/subjects/:id/export`. */
export const subjectExportManifestSchema = z.object({
  product: productSchema,
  categories: z
    .array(
      z.object({
        id: z.string().min(1),
        schemaVersion: z.number().int().positive(),
        /** How many records the category holds right now, for progress and the summary. */
        count: z.number().int().nonnegative(),
      }),
    )
    .max(50),
});

/** What a product answers on `GET .../export/:category?cursor=`. `nextCursor` is null on the last page. */
export const subjectExportPageSchema = z.object({
  records: z.array(subjectExportRecordSchema).max(SUBJECT_EXPORT_MAX_PAGE_RECORDS),
  nextCursor: z.string().min(1).nullable(),
});

/** The shape of every JSON file in the download. */
export const subjectExportFileSchema = z.object({
  schema: z.string().regex(/^lax\.subject-export\/[a-z]+\/[a-z0-9-]+@\d+$/),
  product: z.string().min(1),
  controller: z.string().min(1),
  generatedAt: subjectExportDateSchema,
  /** Empty when nothing is held: "nothing held" is stated, not implied. */
  records: z.array(subjectExportRecordSchema),
});

// Request lifecycle -------------------------------------------------------------------------

export const SUBJECT_EXPORT_STATUSES = [
  "requested",
  "collecting",
  "delayed",
  "ready",
  "expired",
  "deleted",
  "failed",
] as const;
export const subjectExportStatusSchema = z.enum(SUBJECT_EXPORT_STATUSES);
export type SubjectExportStatus = z.infer<typeof subjectExportStatusSchema>;

/** Statuses that count as the one open request. */
export const SUBJECT_EXPORT_OPEN_STATUSES: readonly SubjectExportStatus[] = [
  "requested",
  "collecting",
  "delayed",
  "ready",
];

/** Progress for one product as the person sees it. */
export const subjectExportProductProgressSchema = z.object({
  product: productSchema,
  state: z.enum(["waiting", "collecting", "done", "retrying"]),
});

/** What LAX Account reads and shows. It never carries the object key. */
export const subjectExportViewSchema = z.object({
  id: z.string().min(1),
  status: subjectExportStatusSchema,
  requestedAt: subjectExportDateSchema,
  /** The legal due date, shown to the person when the request is delayed. */
  dueAt: subjectExportDateSchema,
  readyAt: subjectExportDateSchema.nullable(),
  /** When the copy is deleted; null until it is ready. */
  expiresAt: subjectExportDateSchema.nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  /** How many times the copy has been downloaded. */
  downloadCount: z.number().int().nonnegative(),
  deletedAt: subjectExportDateSchema.nullable(),
  products: z.array(subjectExportProductProgressSchema),
});

/** `POST /lax/data-exports`: business outcomes travel with HTTP 200, as deletion's do. */
export const subjectExportCreateOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("requested"), export: subjectExportViewSchema }),
  /** One request is open already; nothing was created. */
  z.object({ outcome: z.literal("already_open"), export: subjectExportViewSchema }),
  /** Four requests in 30 days; `retryAfter` is when the oldest one leaves the window. */
  z.object({ outcome: z.literal("rate_limited"), retryAfter: subjectExportDateSchema }),
]);

/** `GET /lax/data-exports/current`: the latest request, or null when there has never been one. */
export const subjectExportCurrentSchema = z.object({
  export: subjectExportViewSchema.nullable(),
});

export const subjectExportDownloadRequestSchema = z.object({ id: z.string().min(1) });
export const subjectExportDeleteRequestSchema = z.object({ id: z.string().min(1) });

/** `POST /lax/data-exports/download`: one signed GET for one object. */
export const subjectExportDownloadSchema = z.object({
  url: z.string().url(),
  expiresAt: subjectExportDateSchema,
});

export const subjectExportDeleteOutcomeSchema = z.object({
  outcome: z.enum(["deleted", "not_found"]),
});

/** What the worker reports on the internal progress route. */
export const subjectExportProgressSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("product_collected"),
    product: productSchema,
    categories: z.array(
      z.object({
        id: z.string().min(1),
        schemaVersion: z.number().int().positive(),
        count: z.number().int().nonnegative(),
      }),
    ),
  }),
  z.object({ event: z.literal("delayed"), product: productSchema, errorCode: z.string().min(1) }),
  z.object({
    event: z.literal("ready"),
    objectKey: z.string().min(1),
    fileName: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.object({ event: z.literal("failed"), errorCode: z.string().min(1) }),
]);

/** What Identity answers on the purge-pending route: the stored copies the worker must delete. */
export const subjectExportPurgePendingSchema = z.object({
  items: z.array(z.object({ exportId: z.string().min(1), objectKey: z.string().min(1) })),
});
export type SubjectExportPurgePending = z.infer<typeof subjectExportPurgePendingSchema>;

export type SubjectExportCategoryManifest = z.infer<
  typeof subjectExportManifestSchema
>["categories"][number];
export type SubjectExportManifest = z.infer<typeof subjectExportManifestSchema>;
export type SubjectExportPage = z.infer<typeof subjectExportPageSchema>;
export type SubjectExportFile = z.infer<typeof subjectExportFileSchema>;
export type SubjectExportMoney = z.infer<typeof subjectExportMoneySchema>;
export type SubjectExportView = z.infer<typeof subjectExportViewSchema>;
export type SubjectExportCreateOutcome = z.infer<typeof subjectExportCreateOutcomeSchema>;
export type SubjectExportProgress = z.infer<typeof subjectExportProgressSchema>;
