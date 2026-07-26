import "server-only";

import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

export type LotActivityPageModel = {
  lotId: string;
  events: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

/** Data/composition boundary for `/admin/lots/[id]/activity`. */
export async function loadAdminLotActivityPage(lotId: string): Promise<LotActivityPageModel> {
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "lot",
    aggregateId: lotId,
    limit: 50,
  }).catch(() => []);

  return { lotId, events };
}
