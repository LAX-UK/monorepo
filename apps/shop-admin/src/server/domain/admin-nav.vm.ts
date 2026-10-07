import type { ShopStaffCapability } from "@auction/shop-domain";

export type AdminNavGroup = {
  title: string;
  items: Array<{ href: string; label: string; capability?: ShopStaffCapability }>;
};

export type AdminSessionNavInput = {
  capabilities: readonly string[];
  features: {
    payouts: boolean;
    thirdPartySales: boolean;
    originalSales: boolean;
    merchandise: boolean;
  };
};

function hasCapability(capabilities: readonly string[], capability: ShopStaffCapability): boolean {
  return capabilities.includes(capability);
}

export function buildAdminNavGroups(input: AdminSessionNavInput): AdminNavGroup[] {
  const caps = input.capabilities;
  const groups: AdminNavGroup[] = [
    {
      title: "Overview",
      items: [{ href: "/overview", label: "Overview", capability: "audit.read" }],
    },
    {
      title: "People",
      items: [
        ...(hasCapability(caps, "client.read_all") || hasCapability(caps, "client.read_assigned")
          ? [{ href: "/clients", label: "Clients" }]
          : []),
        { href: "/artists", label: "Artists", capability: "catalogue.write" },
        { href: "/requests", label: "Limit requests", capability: "sale_authority.write" },
        { href: "/staff", label: "Staff", capability: "settings.write" },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/artworks", label: "Artworks", capability: "catalogue.write" },
        ...(input.features.merchandise
          ? [
              {
                href: "/merchandise",
                label: "Merchandise",
                capability: "merchandise.read" as const,
              },
            ]
          : []),
      ],
    },
    {
      title: "Orders",
      items: [
        { href: "/orders", label: "Orders", capability: "audit.read" },
        ...(input.features.payouts
          ? [
              { href: "/production", label: "Production", capability: "production.write" as const },
              { href: "/fulfilment", label: "Fulfilment", capability: "fulfilment.write" as const },
            ]
          : []),
      ],
    },
    {
      title: "Finance",
      items: input.features.payouts
        ? [{ href: "/payouts", label: "Payouts", capability: "payout.mark_paid" as const }]
        : [],
    },
    {
      title: "Sales",
      items: [
        ...(input.features.thirdPartySales
          ? [
              { href: "/holds", label: "Stock holds", capability: "stock_hold.write" as const },
              {
                href: "/third-party-sales",
                label: "Third-party sales",
                capability: "third_party_sale.write" as const,
              },
            ]
          : []),
        ...(input.features.originalSales
          ? [
              {
                href: "/original-sales",
                label: "Original sales",
                capability: "original_sale.write" as const,
              },
            ]
          : []),
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
