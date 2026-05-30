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

export const CONDITION_REPORTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "specialist.appraise", "platform.admin.full"],
};

export const LOTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "auction.manage", "platform.admin.full"],
};

export const SALES_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};

/** View draft sales and work on catalog prep / lots in sale setup. */
export const SALE_CATALOG_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write", "platform.admin.full"],
};

export const ARTISTS_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.read", "artist.review", "catalogue.write", "platform.admin.full"],
};

export const ARTIST_DELETE_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.delete", "platform.admin.full"],
};

export const CATEGORIES_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "platform.admin.full"],
};

export const SALEROOM_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};

export const CONVEYOR_ACCESS: CapabilityRequirement = {
  anyOf: ["operations.fulfilment", "platform.admin.full"],
};
