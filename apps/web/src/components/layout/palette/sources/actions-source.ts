import type { PaletteItem } from "@/components/layout/palette/types";
import type { SessionUser } from "@/lib/data/contracts";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";

export function buildActionPaletteItems(
  query: string,
  variant: "marketing" | "dashboard" | "admin",
  sessionUser?: SessionUser | null,
): PaletteItem[] {
  const q = query.trim();
  if (!q) return [];

  const actionItems: PaletteItem[] = [
    {
      id: "action-search-all",
      href: `/search?q=${encodeURIComponent(q)}`,
      label: `Search all lots for "${q}"`,
    },
  ];

  if (
    variant === "admin" &&
    sessionUser &&
    canAccessPlatformAdminRoutes(sessionUser.role as UserRole, sessionUser.staffRole ?? null)
  ) {
    actionItems.push(
      {
        id: "action-admin-lots-q",
        href: `/admin/lots?q=${encodeURIComponent(q)}`,
        label: `Lots list · title contains "${q}"`,
      },
      {
        id: "action-admin-artists-q",
        href: `/admin/artists?q=${encodeURIComponent(q)}`,
        label: `Artists · search "${q}"`,
      },
    );
    const maybeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(q);
    if (maybeUuid) {
      const id = maybeUuid[0];
      actionItems.push(
        {
          id: "action-open-lot",
          href: `/admin/lots/${id}`,
          label: `Open lot ${id}`,
          hint: "UUID",
        },
        {
          id: "action-publish-lot",
          href: `/admin/lots/${id}#publish`,
          label: `Lot detail (publish) · ${id.slice(0, 8)}…`,
        },
        {
          id: "action-open-submission",
          href: `/admin/submissions/${id}`,
          label: `Open submission ${id.slice(0, 8)}…`,
          hint: "UUID",
        },
        {
          id: "action-open-user",
          href: `/admin/clients/${id}`,
          label: `Open account ${id.slice(0, 8)}…`,
          hint: "UUID",
        },
      );
    }
  }

  return actionItems;
}
