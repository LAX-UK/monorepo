import {
  type Lot,
  type LotStatus,
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleStatusTransitionService } from "./interfaces/sale-status-transition.js";

/** Allowed admin overrides per current lot status. These intentionally do not
 * include moves back into `active` (admins should only be ending or cancelling).
 */
const ALLOWED_LOT_TRANSITIONS: Record<LotStatus, ReadonlySet<LotStatus>> = {
  draft: new Set(["scheduled", "cancelled"]),
  scheduled: new Set(["cancelled"]),
  active: new Set(["ended", "cancelled"]),
  ended: new Set(),
  cancelled: new Set(),
  voided: new Set(),
};

export class SaleStatusTransitionService implements ISaleStatusTransitionService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
  ) {}

  async markOnsiteSaleEnded(
    userRole: string,
    saleId: string,
    _reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can change sale status", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (saleModeAllowsBidding(sale.deliveryMode)) {
      return err(
        new LotError("Only onsite sales can be ended manually; online sales end automatically"),
      );
    }
    if (sale.status !== "active" && sale.status !== "scheduled") {
      return err(new LotError("Only active or scheduled sales can be marked ended"));
    }

    const lots = await this.lotRepo.findBySaleId(saleId);
    for (const l of lots) {
      if (l.status === "scheduled" || l.status === "active") {
        await this.jobScheduler?.cancelLotJobs(l.id);
        await this.lotRepo.updateStatus(l.id, "ended");
      }
    }
    await this.saleRepo.updateStatus(saleId, "ended");

    const updatedSale = await this.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.lotRepo.findBySaleId(saleId);
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  async cancelLot(
    userRole: string,
    saleId: string,
    lotId: string,
    _reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can cancel lots", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    const l = await this.lotRepo.findById(lotId);
    if (!l || l.saleId !== saleId) {
      return err(new LotError("Lot not found in this sale", 404));
    }
    if (l.status !== "draft" && l.status !== "scheduled" && l.status !== "active") {
      return err(new LotError("Lot cannot be cancelled in its current status"));
    }
    await this.jobScheduler?.cancelLotJobs(lotId);
    await this.lotRepo.updateStatus(lotId, "cancelled");
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));
    return ok(updated);
  }

  async setLotStatus(
    userRole: string,
    saleId: string,
    lotId: string,
    status: LotStatus,
    _reason?: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can change lot status", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    const l = await this.lotRepo.findById(lotId);
    if (!l || l.saleId !== saleId) {
      return err(new LotError("Lot not found in this sale", 404));
    }
    const allowed = ALLOWED_LOT_TRANSITIONS[l.status];
    if (!allowed.has(status)) {
      return err(new LotError(`Cannot move lot from ${l.status} to ${status} via admin override`));
    }
    if (status === "cancelled" || status === "ended") {
      await this.jobScheduler?.cancelLotJobs(lotId);
    }
    await this.lotRepo.updateStatus(lotId, status);
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));
    return ok(updated);
  }
}
