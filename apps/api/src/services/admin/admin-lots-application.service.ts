import type { UserRole } from "@auction/types";
import type { Lot } from "@auction/types";
import { AuthzError, LotError } from "../../lib/errors.js";
import type { IAdminLotsApplicationService } from "../interfaces/admin-routes.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { LotLifecycleQueryService } from "../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../lot-transition-orchestrator.js";
import type { AdminLotBrowseService } from "./admin-lot-browse.service.js";

export class AdminLotsApplicationService implements IAdminLotsApplicationService {
  constructor(
    private readonly lots: ILotService,
    private readonly lotBrowse: AdminLotBrowseService,
    private readonly lotTransitions: LotTransitionOrchestrator,
    private readonly lotLifecycleQuery: LotLifecycleQueryService,
  ) {}

  async approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: import("@auction/types").UserStaffRole | null,
  ): Promise<
    | { ok: true; data: Lot }
    | { ok: false; status: number; error: string; code?: string | undefined }
  > {
    const result = await this.lots.approveWithdrawalRequest(
      adminUserId,
      adminRole,
      lotId,
      adminStaffRole,
    );
    if (result.isOk()) {
      return { ok: true, data: result.value };
    }
    const e = result.error;
    if (e instanceof LotError && e.code) {
      return { ok: false, status: e.status, error: e.message, code: e.code };
    }
    if (e instanceof AuthzError) {
      return { ok: false, status: e.status, error: e.message };
    }
    return { ok: false, status: (e as { status?: number }).status ?? 400, error: e.message };
  }

  listAttachable(...args: Parameters<AdminLotBrowseService["listAttachable"]>) {
    return this.lotBrowse.listAttachable(...args);
  }

  returnToInventory(...args: Parameters<LotTransitionOrchestrator["returnToInventory"]>) {
    return this.lotTransitions.returnToInventory(...args);
  }

  async getLifecycle(lotId: string, opts: { limit?: number; includeSaleContext?: boolean } = {}) {
    const snapshot = await this.lotLifecycleQuery.getSnapshot(lotId);
    const events = await this.lotLifecycleQuery.timeline(lotId, {
      limit: opts.limit ?? 10,
      includeSaleContext: opts.includeSaleContext ?? true,
    });
    return { snapshot, events };
  }
}
