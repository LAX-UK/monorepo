import type { ShopStaffCapability } from "@auction/shop-domain";

export type AdminNavGroup = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    capability?: ShopStaffCapability;
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
};

function hasCapability(capabilities: readonly string[], capability: ShopStaffCapability): boolean {
  return capabilities.includes(capability);
}

export function buildAdminNavGroups(input: AdminSessionNavInput): AdminNavGroup[] {
  const caps = input.capabilities;
  const groups: AdminNavGroup[] = [
    {
      title: "Overview",
      items: [{ href: "/overview", label: "Overview" }],
    },
    {
      title: "Gallery",
      items: [
        { href: "/artworks", label: "Artworks", capability: "catalogue.write" },
        { href: "/artists", label: "Artists", capability: "catalogue.write" },
        { href: "/editorial/exhibitions", label: "Exhibitions", capability: "editorial.write" },
        { href: "/editorial/stories", label: "Stories", capability: "editorial.write" },
        { href: "/editorial/venues", label: "Venues", capability: "editorial.write" },
        { href: "/editorial/pages", label: "Pages", capability: "editorial.write" },
        { href: "/help", label: "Help centre", capability: "editorial.write" },
        { href: "/editorial/home", label: "Home placements", capability: "editorial.write" },
        {
          href: "/enquiries",
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
          ? [{ href: "/merchandise", label: "Products", capability: "merchandise.read" as const }]
          : []),
        { href: "/orders", label: "Orders", capability: "order.read" },
        ...(input.features.payouts
          ? [
              { href: "/production", label: "Production", capability: "production.write" as const },
              { href: "/fulfilment", label: "Fulfilment", capability: "fulfilment.write" as const },
            ]
          : []),
        ...(input.features.thirdPartySales
          ? [{ href: "/holds", label: "Stock holds", capability: "stock_hold.write" as const }]
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
                label: "Original sales",
                capability: "original_sale.write" as const,
              },
            ]
          : []),
        ...(input.features.thirdPartySales
          ? [
              {
                href: "/third-party-sales",
                label: "Third-party sales",
                capability: "third_party_sale.write" as const,
              },
            ]
          : []),
        { href: "/requests", label: "Sale limit requests", capability: "sale_authority.write" },
      ],
    },
    {
      title: "Clients",
      items:
        hasCapability(caps, "client.read_all") || hasCapability(caps, "client.read_assigned")
          ? [{ href: "/clients", label: "Clients" }]
          : [],
    },
    {
      title: "Finance",
      items: [
        ...(input.features.payouts
          ? [{ href: "/payouts", label: "Payouts", capability: "payout.mark_paid" as const }]
          : []),
        { href: "/disputes", label: "Disputes", capability: "audit.read" as const },
      ],
    },
    {
      title: "Admin",
      items: [
        { href: "/staff", label: "Staff", capability: "settings.write" },
        { href: "/audit", label: "Audit log", capability: "audit.read" as const },
        { href: "/settings", label: "Settings", capability: "settings.write" as const },
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
