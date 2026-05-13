import type { CapabilityRequirement } from "@auction/types";

/** Minimum access to show the staff admin home link in the shell. */
export const STAFF_OVERVIEW_ACCESS: CapabilityRequirement = {
  anyOf: [
    "auction.manage",
    "catalogue.write",
    "specialist.appraise",
    "operations.fulfilment",
    "content.write",
    "support.respond",
    "finance.read",
    "platform.admin.full",
    "legal_entity.read",
    "artist.read",
  ],
};

export const SUBMISSIONS_ACCESS: CapabilityRequirement = {
  anyOf: ["specialist.appraise", "catalogue.write", "auction.manage"],
};

export const EMAIL_OUTBOX_ACCESS: CapabilityRequirement = {
  anyOf: ["support.respond", "platform.admin.full"],
};

export const AUDIT_ACCESS: CapabilityRequirement = {
  anyOf: ["audit.read_pii", "platform.admin.full"],
};

export const CMS_ACCESS: CapabilityRequirement = {
  anyOf: ["content.write", "platform.admin.full"],
};

export const CONDITION_REPORTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "specialist.appraise", "platform.admin.full"],
};
