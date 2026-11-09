import {
  AML_REVIEW_ACCESS,
  COLLECTIONS_READ_ACCESS,
  CONDITION_REPORTS_READ_ACCESS,
  ENQUIRIES_ACCESS,
  FINANCE_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_READ_ACCESS,
  LOT_FULFILMENT_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PRIVATE_SALE_DEALS_READ_ACCESS,
  PURCHASE_PROBLEMS_ACCESS,
  SALEROOM_ACCESS,
  SALES_ACCESS,
  SALE_CATALOG_READ_ACCESS,
  STAFF_ACCESS_REVIEW_ACCESS,
  SUBMISSIONS_ACCESS,
  SUBMISSIONS_READ_ACCESS,
  USERS_DIRECTORY_ACCESS,
} from "./admin-access.js";
import { FAILED_JOBS_ANY_SOURCE_READ_ACCESS } from "./failed-jobs.js";
import {
  type CapabilityRequirement,
  type StaffRoles,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  userHasAccessTo,
} from "./role-policy.js";
import type { UserRole } from "./user.js";

/**
 * Every Bid admin page that a staff alert, queue line or notification email links to, with the
 * route group it lives in and the capability its page guard asks for. Links are built with
 * `adminRoutes` only, so each one resolves to an entry here and the pair cannot drift apart.
 */
export type AdminRouteEntry = {
  /** The page path, with `[param]` for each dynamic segment. */
  pattern: string;
  area: "platform" | "finance" | "shared";
  requirement: CapabilityRequirement;
};

export const ADMIN_ROUTE_TABLE = [
  { pattern: "/admin/clients", area: "platform", requirement: USERS_DIRECTORY_ACCESS },
  { pattern: "/admin/clients/[id]", area: "platform", requirement: USERS_DIRECTORY_ACCESS },
  { pattern: "/admin/sales", area: "platform", requirement: SALE_CATALOG_READ_ACCESS },
  { pattern: "/admin/finance", area: "finance", requirement: FINANCE_ACCESS },
  { pattern: "/admin/saleroom", area: "platform", requirement: SALEROOM_ACCESS },
  { pattern: "/admin/submissions", area: "platform", requirement: SUBMISSIONS_READ_ACCESS },
  { pattern: "/admin/payments", area: "finance", requirement: FINANCE_ACCESS },
  { pattern: "/admin/payouts", area: "finance", requirement: FINANCE_ACCESS },
  { pattern: "/admin/disputes", area: "finance", requirement: FINANCE_ACCESS },
  { pattern: "/admin/compliance/aml", area: "platform", requirement: AML_REVIEW_ACCESS },
  {
    pattern: "/admin/compliance/source-of-funds",
    area: "platform",
    requirement: AML_REVIEW_ACCESS,
  },
  {
    pattern: "/admin/compliance/source-of-funds/[id]",
    area: "platform",
    requirement: AML_REVIEW_ACCESS,
  },
  {
    pattern: "/admin/condition-reports",
    area: "platform",
    requirement: CONDITION_REPORTS_READ_ACCESS,
  },
  { pattern: "/admin/enquiries/[reference]", area: "platform", requirement: ENQUIRIES_ACCESS },
  {
    pattern: "/admin/private-sales/[reference]",
    area: "shared",
    requirement: PRIVATE_SALE_DEALS_READ_ACCESS,
  },
  { pattern: "/admin/purchase-problems", area: "platform", requirement: PURCHASE_PROBLEMS_ACCESS },
  {
    pattern: "/admin/purchase-problems/[id]",
    area: "platform",
    requirement: PURCHASE_PROBLEMS_ACCESS,
  },
  {
    pattern: "/admin/failed-jobs",
    area: "shared",
    requirement: FAILED_JOBS_ANY_SOURCE_READ_ACCESS,
  },
  {
    pattern: "/admin/failed-jobs/[id]",
    area: "shared",
    requirement: FAILED_JOBS_ANY_SOURCE_READ_ACCESS,
  },
  {
    pattern: "/admin/legal-entities/[id]",
    area: "platform",
    requirement: LEGAL_ENTITY_BROWSE_ACCESS,
  },
  { pattern: "/admin/collections", area: "platform", requirement: COLLECTIONS_READ_ACCESS },
  { pattern: "/admin/lot-fulfilment", area: "platform", requirement: LOT_FULFILMENT_ACCESS },
  { pattern: "/admin/lots", area: "platform", requirement: LOTS_READ_ACCESS },
  { pattern: "/admin/lots/[id]", area: "platform", requirement: LOTS_READ_ACCESS },
  {
    pattern: "/admin/onboarding-issues",
    area: "platform",
    requirement: ONBOARDING_QUEUES_ACCESS,
  },
  { pattern: "/admin/sales/[id]", area: "platform", requirement: SALE_CATALOG_READ_ACCESS },
  { pattern: "/admin/sales/[id]/lots", area: "platform", requirement: SALE_CATALOG_READ_ACCESS },
  { pattern: "/admin/sales/[id]/registrations", area: "platform", requirement: SALES_ACCESS },
  { pattern: "/admin/sales/[id]/telephone-bookings", area: "platform", requirement: SALES_ACCESS },
  { pattern: "/admin/saleroom/[id]", area: "platform", requirement: SALEROOM_ACCESS },
  { pattern: "/admin/staff/access", area: "platform", requirement: STAFF_ACCESS_REVIEW_ACCESS },
  { pattern: "/admin/submissions/[id]", area: "platform", requirement: SUBMISSIONS_READ_ACCESS },
  {
    pattern: "/admin/submissions/[id]/decision",
    area: "platform",
    requirement: SUBMISSIONS_ACCESS,
  },
] as const satisfies readonly AdminRouteEntry[];

export type AdminRoutePattern = (typeof ADMIN_ROUTE_TABLE)[number]["pattern"];

const seg = (id: string): string => encodeURIComponent(id);

/**
 * Link targets in LAX Admin (the Shop and lax.art staff app), which has its own origin. These are
 * paths on that origin, not on Bid admin's.
 */
export const laxAdminRoutes = {
  orders: {
    order: (orderId: string) => `/orders/${seg(orderId)}`,
  },
} as const;

/** One builder per link target. Ids are encoded; query strings are part of the builder. */
export const adminRoutes = {
  privateSales: {
    deal: (reference: string) => `/admin/private-sales/${encodeURIComponent(reference)}`,
  },
  payments: {
    list: () => "/admin/payments",
    manualReview: () => "/admin/payments?manualReview=1",
    /** The payments list with one payment's panel open. */
    panel: (paymentId: string) => `/admin/payments?payment=${encodeURIComponent(paymentId)}`,
  },
  aml: {
    list: () => "/admin/compliance/aml",
    screening: (screeningId: string) =>
      `/admin/compliance/aml?screening=${encodeURIComponent(screeningId)}`,
  },
  sourceOfFunds: {
    list: () => "/admin/compliance/source-of-funds",
    detail: (id: string) => `/admin/compliance/source-of-funds/${seg(id)}`,
  },
  /** An enquiry record; the page accepts its reference or its id. */
  enquiry: (referenceOrId: string) => `/admin/enquiries/${seg(referenceOrId)}`,
  /** The purchase problems list, and one report's record. */
  purchaseProblems: {
    list: () => "/admin/purchase-problems",
    record: (id: string) => `/admin/purchase-problems/${seg(id)}`,
  },
  /** One client's record. */
  client: (id: string) => `/admin/clients/${seg(id)}`,
  conditionReports: { list: () => "/admin/condition-reports" },
  lotFulfilment: { list: () => "/admin/lot-fulfilment" },
  /** The collection hours and rules, and the closures, of one place (the first when omitted). */
  collections: {
    hours: (venueId?: string) =>
      venueId ? `/admin/collections?venue=${encodeURIComponent(venueId)}` : "/admin/collections",
    closures: (venueId?: string) =>
      `/admin/collections?tab=closures${venueId ? `&venue=${encodeURIComponent(venueId)}` : ""}`,
  },
  legalEntity: (id: string) => `/admin/legal-entities/${seg(id)}`,
  lots: { list: () => "/admin/lots" },
  lot: (id: string) => `/admin/lots/${seg(id)}`,
  onboardingIssues: () => "/admin/onboarding-issues",
  sale: {
    detail: (id: string) => `/admin/sales/${seg(id)}`,
    lots: (id: string) => `/admin/sales/${seg(id)}/lots`,
    registrations: (id: string, status?: string) =>
      `/admin/sales/${seg(id)}/registrations${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    telephoneBookings: (id: string, status?: string) =>
      `/admin/sales/${seg(id)}/telephone-bookings${status ? `?status=${encodeURIComponent(status)}` : ""}`,
  },
  saleroom: { console: (saleId: string) => `/admin/saleroom/${seg(saleId)}` },
  staffAccess: () => "/admin/staff/access",
  submission: (id: string) => `/admin/submissions/${seg(id)}`,
  submissionDecision: (id: string) => `/admin/submissions/${seg(id)}/decision`,
} as const;

/** The table entry a path (query and hash ignored) resolves to, or undefined if none does. */
export function resolveAdminRoute(href: string): (typeof ADMIN_ROUTE_TABLE)[number] | undefined {
  const path = href.split(/[?#]/)[0] ?? href;
  const parts = path.split("/").filter(Boolean);
  return ADMIN_ROUTE_TABLE.find((entry) => {
    const pattern = entry.pattern.split("/").filter(Boolean);
    return (
      pattern.length === parts.length &&
      pattern.every((p, i) => (p.startsWith("[") ? (parts[i] ?? "").length > 0 : p === parts[i]))
    );
  });
}

/**
 * Whether this person can open the page a link points at: they may enter its route group and
 * hold the capability its page guard asks for. A link that is not in the table cannot be opened.
 */
export function canOpenAdminLink(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  href: string,
): boolean {
  const entry = resolveAdminRoute(href);
  if (!entry) return false;
  const inArea =
    entry.area === "finance"
      ? canAccessFinanceAdminRoutes(role, staffRoles)
      : entry.area === "platform"
        ? canAccessPlatformAdminRoutes(role, staffRoles)
        : role === "staff";
  return inArea && userHasAccessTo(role, staffRoles, entry.requirement);
}
