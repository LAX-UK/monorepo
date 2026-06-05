import type { OnsiteEvent, OnsiteEventListItem } from "@auction/types";

export interface IOnsiteEventRepository {
  findBySlug(slug: string): Promise<OnsiteEvent | null>;
  listAdminItems(): Promise<OnsiteEventListItem[]>;
  updateCheckInDryRun(slug: string, enabled: boolean): Promise<OnsiteEvent | null>;
}
