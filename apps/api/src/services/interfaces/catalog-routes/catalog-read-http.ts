import type { StaffRoles } from "@auction/types";
export type CatalogHttpJson = { status: number; body: unknown };

export type CatalogViewerContext = {
  userId?: string | null | undefined;
  role?: string | null | undefined;
  staffRoles?: StaffRoles | undefined;
};
