import type { AttentionDomain } from "@/lib/admin/admin-home-types";
import type { DashboardWidgetId } from "@/lib/admin/dashboard-widgets.vm";
import type { RoleKpiDefinitionId } from "@/lib/admin/dashboard/role-kpis.slice";
import {
  AML_REVIEW_ACCESS,
  type CapabilityRequirement,
  FINANCE_ACCESS,
  LOTS_ACCESS,
  SALEROOM_ACCESS,
  SUBMISSIONS_ACCESS,
  type UserStaffRole,
} from "@auction/types";

export type DashboardProfileId =
  | "oversight"
  | "auction_operations"
  | "catalogue"
  | "finance"
  | "compliance"
  | "service_fulfilment"
  | "read_only";

export type DashboardPrimaryAction = {
  href: string;
  label: string;
  requirement: CapabilityRequirement | null;
  fallbackHref: string;
  fallbackLabel: string;
};

export type DashboardProfile = {
  id: DashboardProfileId;
  label: string;
  /** Top operational decisions this profile optimizes for. */
  decisions: readonly string[];
  primaryAction: DashboardPrimaryAction;
  queueDomains: readonly AttentionDomain[];
  kpiIds: readonly RoleKpiDefinitionId[];
  showLiveOperations: boolean;
  secondaryWidgets: readonly DashboardWidgetId[];
  emptyStateNextStep: string;
};

const SHARED_PRIMARY_SUBMISSIONS: DashboardPrimaryAction = {
  href: "/admin/submissions",
  label: "Submissions",
  requirement: SUBMISSIONS_ACCESS,
  fallbackHref: "/admin/lots",
  fallbackLabel: "Open lots",
};

const PROFILES: Record<DashboardProfileId, DashboardProfile> = {
  oversight: {
    id: "oversight",
    label: "Oversight",
    decisions: [
      "What exceptions need executive attention?",
      "Is operational health stable across domains?",
      "Where are cross-domain blockers?",
    ],
    primaryAction: {
      href: "/admin/finance",
      label: "Finance hub",
      requirement: FINANCE_ACCESS,
      fallbackHref: "/admin/lots",
      fallbackLabel: "Open lots",
    },
    queueDomains: ["Finance", "Compliance", "Operations", "Catalog", "People"],
    kpiIds: ["live-lots", "new-lots", "stale-payments", "revenue-today", "bids-per-minute"],
    showLiveOperations: true,
    secondaryWidgets: ["activity"],
    emptyStateNextStep: "Review finance and compliance queues when badges update.",
  },
  auction_operations: {
    id: "auction_operations",
    label: "Auction operations",
    decisions: [
      "Which live sale needs intervention?",
      "Are registrations or telephone lines blocked?",
      "Which lots need action before hammer?",
    ],
    primaryAction: {
      href: "/admin/saleroom",
      label: "Open saleroom",
      requirement: SALEROOM_ACCESS,
      fallbackHref: "/admin/lots",
      fallbackLabel: "Open lots",
    },
    queueDomains: ["Operations", "Catalog", "Finance"],
    kpiIds: ["live-lots", "bids-per-minute", "new-lots", "stale-payments"],
    showLiveOperations: true,
    secondaryWidgets: ["saleroom-live", "onsite-radar", "activity"],
    emptyStateNextStep: "Open saleroom when a session goes live.",
  },
  catalogue: {
    id: "catalogue",
    label: "Catalogue",
    decisions: [
      "Which submissions need a decision?",
      "Which records are incomplete before publish?",
      "What catalogue work is blocking go-live?",
    ],
    primaryAction: SHARED_PRIMARY_SUBMISSIONS,
    queueDomains: ["Catalog", "Operations", "People"],
    kpiIds: ["submissions", "new-lots", "live-lots"],
    showLiveOperations: false,
    secondaryWidgets: ["activity"],
    emptyStateNextStep: "Open submissions to review pending consignments.",
  },
  finance: {
    id: "finance",
    label: "Finance",
    decisions: [
      "Which payments are stale or blocked?",
      "Are payouts or disputes aging?",
      "What settlement work is overdue?",
    ],
    primaryAction: {
      href: "/admin/payments?manualReview=1",
      label: "Review payments",
      requirement: FINANCE_ACCESS,
      fallbackHref: "/admin/finance",
      fallbackLabel: "Finance hub",
    },
    queueDomains: ["Finance", "Compliance"],
    kpiIds: ["stale-payments", "payments", "revenue-today"],
    showLiveOperations: false,
    secondaryWidgets: [],
    emptyStateNextStep: "Open payments when manual review badges appear.",
  },
  compliance: {
    id: "compliance",
    label: "Compliance",
    decisions: [
      "Which AML or SoF cases are aging?",
      "What needs escalation or disposition?",
      "Are finance holds blocking settlement?",
    ],
    primaryAction: {
      href: "/admin/compliance/aml",
      label: "Review AML",
      requirement: AML_REVIEW_ACCESS,
      fallbackHref: "/admin/compliance/source-of-funds",
      fallbackLabel: "Source of funds",
    },
    queueDomains: ["Compliance", "Finance", "People"],
    kpiIds: ["stale-payments", "payments"],
    showLiveOperations: false,
    secondaryWidgets: [],
    emptyStateNextStep: "Open compliance queues when screening badges update.",
  },
  service_fulfilment: {
    id: "service_fulfilment",
    label: "Service & fulfilment",
    decisions: [
      "Which fulfilment cases are blocked?",
      "Which client cases need follow-up?",
      "Are invitations or onboarding stuck?",
    ],
    primaryAction: {
      href: "/admin/lot-fulfilment",
      label: "Open fulfilment",
      requirement: LOTS_ACCESS,
      fallbackHref: "/admin/clients",
      fallbackLabel: "Open clients",
    },
    queueDomains: ["Operations", "People", "Catalog"],
    kpiIds: ["live-lots", "new-lots", "submissions"],
    showLiveOperations: false,
    secondaryWidgets: ["activity"],
    emptyStateNextStep: "Open fulfilment when post-sale work queues up.",
  },
  read_only: {
    id: "read_only",
    label: "Read-only",
    decisions: ["What is the current operational snapshot?", "Where can I drill down safely?"],
    primaryAction: {
      href: "/admin/lots",
      label: "Browse lots",
      requirement: null,
      fallbackHref: "/admin/sales",
      fallbackLabel: "Browse sales",
    },
    queueDomains: ["Finance", "Compliance", "Catalog", "Operations", "People"],
    kpiIds: ["live-lots", "new-lots", "bids-per-minute"],
    showLiveOperations: false,
    secondaryWidgets: ["activity"],
    emptyStateNextStep: "Use hub shortcuts to browse accessible areas.",
  },
};

const STAFF_ROLE_PROFILE: Partial<Record<UserStaffRole, DashboardProfileId>> = {
  super_admin: "oversight",
  auction_manager: "auction_operations",
  operations: "auction_operations",
  catalogue_manager: "catalogue",
  specialist: "catalogue",
  content_marketing: "catalogue",
  finance_ops: "finance",
  compliance_officer: "compliance",
  operations_fulfilment: "service_fulfilment",
  support_concierge: "service_fulfilment",
  client_advisor: "service_fulfilment",
  staff_viewer: "read_only",
};

const PROFILE_PRIORITY: readonly DashboardProfileId[] = [
  "oversight",
  "auction_operations",
  "finance",
  "compliance",
  "catalogue",
  "service_fulfilment",
  "read_only",
];

export function dashboardProfileIdForStaffRole(
  staffRole: UserStaffRole | null,
): DashboardProfileId {
  if (staffRole == null) return "auction_operations";
  return STAFF_ROLE_PROFILE[staffRole] ?? "auction_operations";
}

export function getDashboardProfile(staffRole: UserStaffRole | null): DashboardProfile {
  return PROFILES[dashboardProfileIdForStaffRole(staffRole)];
}

export function listDashboardProfiles(): readonly DashboardProfile[] {
  return PROFILE_PRIORITY.map((id) => PROFILES[id]);
}

export function resolvePrimaryActionForProfile(
  profile: DashboardProfile,
  canAccessRequirement: (requirement: CapabilityRequirement | null) => boolean,
): { href: string; label: string } {
  const { primaryAction } = profile;
  if (primaryAction.requirement == null || canAccessRequirement(primaryAction.requirement)) {
    return { href: primaryAction.href, label: primaryAction.label };
  }
  return { href: primaryAction.fallbackHref, label: primaryAction.fallbackLabel };
}
