import { parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import {
  type AdminConveyorPipelineRow,
  getAdminConveyorPipeline,
} from "@/lib/data/http/admin.server";

export const conveyorListController: IAdminListController<
  AdminConveyorPipelineRow,
  AdminListQueryBase
> = {
  id: "conveyor",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const limit = Math.min(500, Math.max(50, base.limit === 50 ? 250 : base.limit));
    return { ...base, limit };
  },
  async fetch(q) {
    const rows = await getAdminConveyorPipeline({ limit: q.limit });
    return { rows, offset: q.offset, limit: q.limit };
  },
};
