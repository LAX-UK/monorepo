import type { UserRole } from "@auction/types";
import type { Lot } from "@auction/types";
import { AuthzError, LotError } from "../../lib/errors.js";
import type { IAdminLotsApplicationService } from "../interfaces/admin-routes.js";
import type { LotService } from "../lot.service.js";

export class AdminLotsApplicationService implements IAdminLotsApplicationService {
  constructor(private readonly lots: LotService) {}

  async approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
  ): Promise<
    | { ok: true; data: Lot }
    | { ok: false; status: number; error: string; code?: string | undefined }
  > {
    const result = await this.lots.approveWithdrawalRequest(adminUserId, adminRole, lotId);
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
}
