import { type ShopStaffCapability, clientListScope } from "@auction/shop-domain";

/**
 * Icon names, not components: the nav is built on the server and handed to the client shell,
 * which maps each name to its icon (components cannot cross that boundary).
 */
export type AdminNavIcon =
  | "overview"
  | "artworks"
  | "artists"
  | "applications"
  | "exhibitions"
  | "stories"
  | "venues"
  | "pages"
  | "help"
  | "placements"
  | "featured"
  | "enquiries"
  | "products"
  | "orders"
  | "production"
  | "fulfilment"
  | "holds"
  | "originalSales"
  | "thirdPartySales"
  | "requests"
  | "clients"
  | "leads"
  | "payouts"
  | "disputes"
  | "staff"
  | "audit"
  | "settings";

export type AdminNavGroup = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    icon: AdminNavIcon;
    /** Shown to staff holding this capability, or any one of these. */
    capability?: ShopStaffCapability | readonly ShopStaffCapability[];
    /** Records waiting for staff, shown as a count beside the label. */
    attentionCount?: number;
  }>;
};

export type AdminSessionNavInput = {
  capabilities: readonly string[];
  features: {
    payouts: boolean;
    thirdPartySales: boolean;
    originalSales: boolean;
    merchandise: boolean;
  };
  /** New enquiries nobody has picked up; 0 when unknown or the role cannot read enquiries. */
  enquiryAttentionCount?: number;
  /** Artist applications nobody has picked up; 0 when unknown or the role cannot review. */
  applicationAttentionCount?: number;
};

function hasCapability(
  capabilities: readonly string[],
  capability: ShopStaffCapability | readonly ShopStaffCapability[],
): boolean {
  const anyOf: readonly ShopStaffCapability[] = Array.isArray(capability)
    ? capability
    : [capability as ShopStaffCapability];
  return anyOf.some((one) => capabilities.includes(one));
}

export function buildAdminNavGroups(input: AdminSessionNavInput): AdminNavGroup[] {
  const caps = input.capabilities;
  const groups: AdminNavGroup[] = [
    {
      title: "Overview",
      items: [{ href: "/overview", icon: "overview" as const, label: "Overview" }],
    },
    {
      title: "Gallery",
      items: [
        {
          href: "/artworks",
          icon: "artworks" as const,
          label: "Artworks",
          // Finance sets edition prices here without editing the catalogue.
          capability: ["catalogue.read", "artwork_price.write"] as const,
        },
        {
          href: "/artists",
          icon: "artists" as const,
          label: "Artists",
          capability: "catalogue.read",
        },
        {
          href: "/artist-applications",
          icon: "applications" as const,
          label: "Artist applications",
          capability: "artist_application.review",
          ...(input.applicationAttentionCount
            ? { attentionCount: input.applicationAttentionCount }
            : {}),
        },
        {
          href: "/editorial/exhibitions",
          icon: "exhibitions" as const,
          label: "Exhibitions",
          capability: "editorial.read",
        },
        {
          href: "/editorial/stories",
          icon: "stories" as const,
          label: "Stories",
          capability: "editorial.read",
        },
        {
          href: "/editorial/venues",
          icon: "venues" as const,
          label: "Venues",
          capability: "editorial.read",
        },
        {
          href: "/editorial/pages",
          icon: "pages" as const,
          label: "Pages",
          capability: "editorial.read",
        },
        {
          href: "/help",
          icon: "help" as const,
          label: "Help centre",
          capability: "editorial.read",
        },
        {
          href: "/editorial/home",
          icon: "placements" as const,
          label: "lax.art home",
          capability: "editorial.read",
        },
        {
          href: "/editorial/featured",
          icon: "featured" as const,
          label: "Featured on home",
          capability: "editorial.read",
        },
        {
          href: "/enquiries",
          icon: "enquiries" as const,
          label: "Enquiries",
          capability: "enquiry.read",
          ...(input.enquiryAttentionCount ? { attentionCount: input.enquiryAttentionCount } : {}),
        },
      ],
    },
    {
      title: "Shop",
      items: [
        ...(input.features.merchandise
          ? [
              {
                href: "/merchandise",
                icon: "products" as const,
                label: "Products",
                capability: "merchandise.read" as const,
              },
            ]
          : []),
        { href: "/orders", icon: "orders" as const, label: "Orders", capability: "order.read" },
        ...(input.features.payouts
          ? [
              {
                href: "/production",
                icon: "production" as const,
                label: "Production",
                capability: "production.write" as const,
              },
              {
                href: "/fulfilment",
                icon: "fulfilment" as const,
                label: "Fulfilment",
                capability: "fulfilment.write" as const,
              },
            ]
          : []),
        ...(input.features.thirdPartySales
          ? [
              {
                href: "/holds",
                icon: "holds" as const,
                label: "Stock holds",
                capability: "stock_hold.write" as const,
              },
            ]
          : []),
      ],
    },
    {
      title: "Sales",
      items: [
        ...(input.features.originalSales
          ? [
              {
                href: "/original-sales",
                icon: "originalSales" as const,
                label: "Original sales",
                capability: "original_sale.write" as const,
              },
            ]
          : []),
        ...(input.features.thirdPartySales
          ? [
              {
                href: "/third-party-sales",
                icon: "thirdPartySales" as const,
                label: "Third-party sales",
                // Operations record the sales; finance approves each sale's fee from the list.
                capability: ["third_party_sale.write", "fee.approve"] as const,
              },
            ]
          : []),
        {
          href: "/requests",
          icon: "requests" as const,
          label: "Sale limit requests",
          capability: "sale_authority.write",
        },
      ],
    },
    {
      title: "Clients",
      items: [
        ...(clientListScope(caps) !== "none"
          ? [{ href: "/clients", icon: "clients" as const, label: "Clients" }]
          : []),
        // People without a LAX account who checked out as a guest or enquired.
        {
          href: "/leads",
          icon: "leads" as const,
          label: "Leads",
          capability: "lead.read" as const,
        },
      ],
    },
    {
      title: "Finance",
      items: [
        ...(input.features.payouts
          ? [
              {
                href: "/payouts",
                icon: "payouts" as const,
                label: "Payouts",
                capability: "payout.mark_paid" as const,
              },
            ]
          : []),
        {
          href: "/disputes",
          icon: "disputes" as const,
          label: "Disputes",
          capability: "audit.read" as const,
        },
      ],
    },
    {
      title: "Admin",
      items: [
        { href: "/staff", icon: "staff" as const, label: "Staff", capability: "settings.write" },
        {
          href: "/audit",
          icon: "audit" as const,
          label: "Audit log",
          capability: "audit.read" as const,
        },
        {
          href: "/settings",
          icon: "settings" as const,
          label: "Settings",
          capability: "settings.write" as const,
        },
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || hasCapability(caps, item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}

export function flattenAdminNav(groups: AdminNavGroup[]): Array<{ href: string; label: string }> {
  return groups.flatMap((g) => g.items);
}
