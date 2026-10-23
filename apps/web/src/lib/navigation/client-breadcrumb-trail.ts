import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import {
  type AppShellRole,
  getRouteLabel,
  getRouteParentLabel,
} from "@/components/layout/app-shell-nav";
import { settingsSectionLabel } from "@/lib/navigation/settings-section-labels";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

const CLIENT_SEGMENT_LABELS: Record<string, string> = {
  checkout: "Checkout",
  organisations: "Organisations",
  invitations: "Invitations",
  settings: "Bid settings",
  seller: "Overview",
  submissions: "Submissions",
  purchases: "Purchases",
  watchlist: "Watching",
  bids: "My bids",
  notifications: "Notifications",
};

const ORG_TAB_LABELS: Record<string, string> = {
  members: "Members",
  profile: "Profile",
  documents: "Documents",
  connect: "Payout setup",
  security: "Two-step policy",
};

function inferClientParentHref(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "dashboard") return undefined;

  const section = segments[1];
  if (!section) return "/dashboard";

  if (section === "settings" && segments.length > 2) {
    return "/dashboard/settings";
  }
  if (section === "checkout" && segments.length > 2) {
    return "/dashboard/purchases";
  }
  if (section === "seller" && segments.length > 2) {
    return "/dashboard/seller";
  }
  if (section === "invitations" && segments.length > 2) {
    return "/dashboard/invitations";
  }

  const navHref = `/dashboard/${section}`;
  return navHref === pathname ? "/dashboard" : navHref;
}

function resolveClientCurrentLabel(pathname: string, workspace: ClientWorkspaceMode): string {
  const segments = pathname.split("/").filter(Boolean);

  const section = segments[1] ?? "";
  if (segments.length === 2) {
    return CLIENT_SEGMENT_LABELS[section] ?? getRouteLabel(pathname, "client", workspace);
  }

  if (section === "invitations") {
    if (segments[2] === "review") return "Review invitation";
    if (segments[2] === "accept") return "Accept invitation";
  }

  if (section === "legal-entities" && segments[segments.length - 1] === "statement") {
    return "Statement";
  }

  if (section === "checkout" && segments.length === 3) return "Checkout";
  if (section === "submissions" && segments.length === 3 && segments[2] === "new") {
    return "New submission";
  }
  if (section === "submissions" && segments.length === 3) return "Submission";
  if (section === "seller" && segments.length === 3) {
    const sellerLeaf: Record<string, string> = {
      connect: "Payout setup",
      payouts: "Sold & payouts",
      consignments: "Consignments",
      works: "Works",
      artist: "Artist profile",
    };
    const sub = segments[2] ?? "";
    if (sellerLeaf[sub]) return sellerLeaf[sub];
  }
  if (section === "settings" && segments.length >= 3) {
    const leaf = segments[segments.length - 1] ?? "settings";
    return settingsSectionLabel(leaf);
  }

  const fromNav = getRouteLabel(pathname, "client", workspace);
  if (fromNav !== "Detail") return fromNav;

  return CLIENT_SEGMENT_LABELS[section] ?? "Detail";
}

/** An organisation's settings pages sit under Selling: Selling > Organisation > Members. */
function buildOrganisationTrail(segments: string[]): BreadcrumbItem[] | null {
  if (segments[1] !== "seller" || segments[2] !== "organisations") return null;
  const orgId = segments[3];
  if (!orgId) return null;

  const selling: BreadcrumbItem = { label: "Selling", href: "/dashboard/seller" };
  const tabLabel = ORG_TAB_LABELS[segments[4] ?? ""];
  if (!tabLabel) return [selling, { label: "Organisation" }];
  return [
    selling,
    { label: "Organisation", href: `/dashboard/seller/organisations/${orgId}` },
    { label: tabLabel },
  ];
}

function buildInvitationsTrail(segments: string[]): BreadcrumbItem[] | null {
  if (segments[1] !== "invitations" || segments.length < 3) return null;
  const action = segments[2];
  if (action === "review") {
    return [
      { label: "Invitations", href: "/dashboard/invitations" },
      { label: "Review invitation" },
    ];
  }
  if (action === "accept") {
    return [
      { label: "Invitations", href: "/dashboard/invitations" },
      { label: "Accept invitation" },
    ];
  }
  return null;
}

function buildLegalEntityStatementTrail(
  segments: string[],
  workspace: ClientWorkspaceMode,
): BreadcrumbItem[] | null {
  if (segments[1] !== "legal-entities" || segments[segments.length - 1] !== "statement") {
    return null;
  }

  const items: BreadcrumbItem[] = [];
  if (workspace === "selling") {
    items.push({ label: "Selling", href: "/dashboard/seller" });
  }
  items.push({ label: "Sold & payouts", href: "/dashboard/seller/payouts" });
  items.push({ label: "Statement" });
  return items;
}

/** Human-readable breadcrumb trail for signed-in client dashboard routes. */
export function buildClientBreadcrumbTrail(
  pathname: string,
  clientWorkspaceMode: ClientWorkspaceMode = "buying",
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  const orgTrail = buildOrganisationTrail(segments);
  if (orgTrail) return orgTrail;

  const invitationsTrail = buildInvitationsTrail(segments);
  if (invitationsTrail) return invitationsTrail;

  const statementTrail = buildLegalEntityStatementTrail(segments, clientWorkspaceMode);
  if (statementTrail) return statementTrail;

  const parent = getRouteParentLabel(pathname, "client" as AppShellRole, clientWorkspaceMode);
  const current = resolveClientCurrentLabel(pathname, clientWorkspaceMode);

  const items: BreadcrumbItem[] = [];

  if (parent && parent !== current) {
    const parentHref = inferClientParentHref(pathname);
    if (parentHref) {
      items.push({ label: parent, href: parentHref });
    } else {
      items.push({ label: parent });
    }
  }

  if (current) {
    items.push({ label: current });
  }

  return items;
}
