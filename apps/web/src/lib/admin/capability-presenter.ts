import type { RoleCapability } from "@auction/types";

export type CapabilityGroupId =
  | "platform"
  | "finance"
  | "catalog"
  | "operations"
  | "compliance"
  | "people";

export type CapabilityPresentation = {
  label: string;
  description: string;
  group: CapabilityGroupId;
};

const CAPABILITY_PRESENTATION: Record<RoleCapability, CapabilityPresentation> = {
  "platform.admin.full": {
    label: "Full platform admin",
    description: "Clients, staff, impersonation, analytics, and unrestricted admin routes.",
    group: "platform",
  },
  "finance.read": {
    label: "View finance",
    description: "Payments, payouts, disputes, and accounting integrations.",
    group: "finance",
  },
  "finance.platform.write": {
    label: "Manage platform finance",
    description: "Capture, refund, and reconcile buyer payments platform-wide.",
    group: "finance",
  },
  "finance.entity.write": {
    label: "Manage entity finance",
    description: "Finance actions scoped to legal entities the user belongs to.",
    group: "finance",
  },
  "finance.write": {
    label: "Legacy finance write",
    description: "Deprecated alias for platform finance writes.",
    group: "finance",
  },
  "user.invite": {
    label: "Invite users",
    description: "Send invitations and assign staff roles.",
    group: "people",
  },
  "auction.manage": {
    label: "Manage sales & saleroom",
    description: "Create sales, run the saleroom, and manage live auction operations.",
    group: "catalog",
  },
  "bid.place": {
    label: "Place bids",
    description: "Client capability to bid in sales.",
    group: "operations",
  },
  "client.submit": {
    label: "Submit consignments",
    description: "Client capability to submit items for sale.",
    group: "operations",
  },
  "legal_entity.read": {
    label: "View legal entities",
    description: "Browse organisations, onboarding status, and related records.",
    group: "people",
  },
  "legal_entity.write": {
    label: "Edit legal entities",
    description: "Update organisation profiles and membership.",
    group: "people",
  },
  "legal_entity.approve": {
    label: "Approve legal entities",
    description: "Move organisations through verification and approval.",
    group: "people",
  },
  "legal_entity.archive": {
    label: "Archive legal entities",
    description: "Archive or restrict organisations no longer active.",
    group: "people",
  },
  "artist.read": {
    label: "View artists",
    description: "Browse the artist registry and linked catalogue records.",
    group: "catalog",
  },
  "artist.review": {
    label: "Review artists",
    description: "Approve or reject pending artist profiles.",
    group: "catalog",
  },
  "artist.merge": {
    label: "Merge artists",
    description: "Consolidate duplicate artist records.",
    group: "catalog",
  },
  "artist.delete": {
    label: "Delete artists",
    description: "Remove artist profiles from the registry.",
    group: "catalog",
  },
  "payout.read": {
    label: "View payouts",
    description: "See seller payout batches and settlement status.",
    group: "finance",
  },
  "payout.process": {
    label: "Process payouts",
    description: "Run settlement and initiate seller transfers.",
    group: "finance",
  },
  "payout.reverse": {
    label: "Reverse payouts",
    description: "Claw back or adjust completed payout lines.",
    group: "finance",
  },
  "audit.read_pii": {
    label: "View audit PII",
    description: "See unredacted PII in compliance and screening records.",
    group: "compliance",
  },
  "catalogue.write": {
    label: "Edit catalogue",
    description: "Lots, categories, condition reports, and catalogue prep.",
    group: "catalog",
  },
  "specialist.appraise": {
    label: "Appraise submissions",
    description: "Specialist review queue for incoming consignments.",
    group: "catalog",
  },
  "operations.fulfilment": {
    label: "Lot fulfilment",
    description: "Post-sale release, shipping, and collection workflows.",
    group: "operations",
  },
  "content.write": {
    label: "Marketing content",
    description: "Edit marketing and content surfaces.",
    group: "operations",
  },
  "support.respond": {
    label: "Support & moderation",
    description: "Respond to clients and moderate user accounts.",
    group: "people",
  },
  "client.read": {
    label: "View clients",
    description: "Browse the client directory and read-only client detail.",
    group: "people",
  },
  "bids.read": {
    label: "View bid history",
    description: "See per-client bid transactions in admin.",
    group: "people",
  },
  "aml.review": {
    label: "AML screening review",
    description: "First-line triage on sanctions and watchlist matches.",
    group: "compliance",
  },
  "compliance.mlro": {
    label: "MLRO decisions",
    description: "Binding clear/block on AML holds and Source of Funds.",
    group: "compliance",
  },
};

const GROUP_LABELS: Record<CapabilityGroupId, string> = {
  platform: "Platform",
  finance: "Finance",
  catalog: "Catalog",
  operations: "Operations",
  compliance: "Compliance",
  people: "People",
};

const GROUP_ORDER: CapabilityGroupId[] = [
  "platform",
  "finance",
  "catalog",
  "operations",
  "compliance",
  "people",
];

export function capabilityPresentation(cap: RoleCapability): CapabilityPresentation {
  return (
    CAPABILITY_PRESENTATION[cap] ?? {
      label: cap.replaceAll(".", " "),
      description: "Staff capability granted by role policy.",
      group: "platform",
    }
  );
}

export function capabilityLabel(cap: RoleCapability): string {
  return capabilityPresentation(cap).label;
}

export function capabilityDescription(cap: RoleCapability): string {
  return capabilityPresentation(cap).description;
}

export function groupCapabilitiesForDisplay(
  caps: readonly RoleCapability[],
): Array<{ id: CapabilityGroupId; label: string; capabilities: RoleCapability[] }> {
  const byGroup = new Map<CapabilityGroupId, RoleCapability[]>();
  for (const cap of caps) {
    const group = capabilityPresentation(cap).group;
    const bucket = byGroup.get(group) ?? [];
    bucket.push(cap);
    byGroup.set(group, bucket);
  }
  return GROUP_ORDER.filter((id) => (byGroup.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    capabilities: byGroup.get(id) ?? [],
  }));
}
