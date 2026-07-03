import type {
  ISaleroomSessionReadService,
  PublicSaleroomSessionStatus,
  SaleroomSessionSnapshot,
  SaleroomSessionStatusRow,
} from "../interfaces/saleroom-service.js";
import type { SaleroomSessionContext } from "./saleroom-session-context.js";

export class SaleroomSessionReadService implements ISaleroomSessionReadService {
  constructor(private readonly ctx: SaleroomSessionContext) {}

  async getPublicSessionStatus(saleId: string): Promise<PublicSaleroomSessionStatus> {
    const session = await this.ctx.sessionRepo.findBySaleId(saleId);
    if (!session) {
      return { status: "none", currentLotId: null };
    }
    return {
      status: session.status,
      currentLotId: session.currentLotId ?? null,
    };
  }

  async getSessionStatuses(saleIds: readonly string[]): Promise<SaleroomSessionStatusRow[]> {
    const uniqueIds = [...new Set(saleIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const rows = await this.ctx.sessionRepo.findStatusSummariesBySaleIds(uniqueIds);
    const bySaleId = new Map(rows.map((row) => [row.saleId, row]));
    return uniqueIds.map((saleId) => {
      const row = bySaleId.get(saleId);
      if (!row) {
        return { saleId, status: "none" as const, currentLotId: null };
      }
      return {
        saleId,
        status: row.status,
        currentLotId: row.currentLotId ?? null,
      };
    });
  }

  async getSessionWithRecentEvents(saleId: string): Promise<SaleroomSessionSnapshot> {
    const session = await this.ctx.sessionRepo.findBySaleId(saleId);
    if (!session) {
      return { session: null, events: [] };
    }
    const events = await this.ctx.sessionRepo.listRecentEvents(session.id);
    return { session, events };
  }
}
