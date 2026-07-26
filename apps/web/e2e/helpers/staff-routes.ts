import { seededStaffRoutes } from "./auth";

export type StaffCatalogListRoute = {
  path: string;
  heading: RegExp;
};

/** Core catalog list pages used by smoke and rollout accessibility gates. */
export const staffCatalogListRoutes = [
  { path: "/admin/lots", heading: /lots/i },
  { path: "/admin/sales", heading: /sales/i },
  { path: "/admin/categories", heading: /categories/i },
  { path: "/admin/artists", heading: /artists/i },
  { path: "/admin/venues", heading: /venues/i },
  { path: "/admin/submissions", heading: /submissions/i },
] as const satisfies readonly StaffCatalogListRoute[];

/** Staff list routes checked for horizontal overflow across breakpoints. */
export const staffViewportListRoutes = [
  "/admin",
  "/admin/lots",
  "/admin/sales",
  "/admin/submissions",
  "/admin/categories",
  "/admin/artists",
  "/admin/venues",
  "/admin/clients",
  "/admin/staff",
  "/admin/legal-entities",
  "/admin/invitations",
  "/admin/payments",
  "/admin/payments?manualReview=1",
  "/admin/disputes",
  "/admin/payouts",
  "/admin/payouts/settlement",
  "/admin/finance",
  "/admin/compliance/aml",
  "/admin/compliance/source-of-funds",
  "/admin/condition-reports",
  "/admin/lot-fulfilment",
  "/admin/onboarding-issues",
  "/admin/saleroom",
  "/admin/event-rsvps",
  "/admin/integrations/xero",
] as const;

export const staffViewportDetailRoutes = [
  `/admin/lots/${seededStaffRoutes.lotDetail}`,
  `/admin/sales/${seededStaffRoutes.saleDetail}`,
  `/admin/clients/${seededStaffRoutes.clientDetail}`,
  `/admin/compliance/source-of-funds/${seededStaffRoutes.sofCaseDetail}`,
  "/admin/lots/new",
  "/admin/sales/new",
] as const;

/** Routes exercised in dark-mode rollout accessibility checks. */
export const staffRolloutA11yRoutes = [
  "/admin",
  "/admin/lots",
  "/admin/sales",
  "/admin/categories",
  `/admin/categories/${seededStaffRoutes.categoryDetail}`,
  `/admin/categories/${seededStaffRoutes.categoryDetail}/edit`,
  "/admin/payments",
  "/admin/disputes",
  "/admin/payouts",
  "/admin/payouts/settlement",
  "/admin/compliance/aml",
  "/admin/compliance/source-of-funds",
  "/admin/invitations",
  "/admin/clients",
  "/admin/staff",
  "/admin/legal-entities",
  "/admin/onboarding-issues",
] as const;

export const staffRolloutConstrainedDesktopRoutes = [
  "/admin/lots",
  "/admin/sales",
  "/admin/categories",
  "/admin/invitations",
  "/admin/clients",
  "/admin/staff",
  "/admin/legal-entities",
  "/admin/onboarding-issues",
] as const;
