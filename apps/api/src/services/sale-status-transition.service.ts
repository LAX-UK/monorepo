import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { Lot, LotStatus, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../lib/errors.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { ILotStatusAdminService } from "./interfaces/lot-status-admin.js";
import type { ISaleStatusTransitionService } from "./interfaces/sale-status-transition.js";
import { LotStatusAdminService } from "./lot-status-admin.service.js";

export class SaleStatusTransitionService implements ISaleStatusTransitionService {
  private readonly lotStatusAdmin: ILotStatusAdminService;

  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly transactionRunner: ITransactionRunner | null = null,
    private readonly domainEventSink: IDomainEventSink | null = null,
    private readonly lotLifecycleRecording: ILotLifecycleRecorder | null = null,
    legalEntityRepository: ILegalEntityRepository | null = null,
    enforceIndividualConnectOnPublish = false,
    private readonly repoFactory: IRepositoryFactory | null = null,
    lotStatusAdmin?: ILotStatusAdminService,
  ) {
    this.lotStatusAdmin =
      lotStatusAdmin ??
      new LotStatusAdminService(
        saleRepo,
        lotRepo,
        jobScheduler,
        transactionRunner,
        lotLifecycleRecording,
        legalEntityRepository,
        enforceIndividualConnectOnPublish,
        repoFactory,
      );
  }

  private txRepos(tx: Database) {
    if (!this.repoFactory) {
      throw new Error("sale_status_transition_repo_factory_required");
    }
    return this.repoFactory.forTransaction(tx);
  }

  private async recordLot(fn: (tx: Database) => Promise<void>): Promise<void> {
    if (!this.transactionRunner || !this.lotLifecycleRecording) return;
    await this.transactionRunner.runInTransaction(fn);
  }

  async markOnsiteSaleEnded(
    userRole: string,
    saleId: string,
    reason?: string,
    userStaffRole?: string | null,
    actorUserId?: string | null,
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
    const endingLots = lots.filter((l) => l.status === "scheduled" || l.status === "active");
    for (const l of endingLots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }
    if (this.transactionRunner && this.lotLifecycleRecording) {
      await this.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = this.txRepos(tx).lot;
        const saleRepo = this.txRepos(tx).sale;
        for (const l of endingLots) {
          await lotRepo.updateStatus(l.id, "ended");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: row,
            payload: {
              outcome: l.winnerId ? "sold" : "no_sale",
              winnerId: l.winnerId,
              saleId: l.saleId,
              trigger: "onsite_sale_end",
            },
            actorUserId: actorUserId ?? null,
          });
        }
        await saleRepo.updateStatus(saleId, "ended");
        if (this.domainEventSink) {
          await this.domainEventSink.withTx(tx).publish({
            aggregateType: "sale",
            aggregateId: saleId,
            eventType: "sale.ended",
            payload: {
              from_status: sale.status,
              to_status: "ended",
              ...(reason ? { reason } : {}),
            },
            actorUserId: actorUserId ?? null,
          });
        }
      });
    } else {
      for (const l of endingLots) {
        await this.lotRepo.updateStatus(l.id, "ended");
        await this.recordLot(async (tx) => {
          await this.lotLifecycleRecording?.recordEnded(tx, {
            lot: { ...l, status: "ended" },
            payload: {
              outcome: l.winnerId ? "sold" : "no_sale",
              winnerId: l.winnerId,
              saleId: l.saleId,
              trigger: "onsite_sale_end",
            },
            actorUserId: actorUserId ?? null,
          });
        });
      }
      await this.saleRepo.updateStatus(saleId, "ended");
      if (this.domainEventSink) {
        await this.domainEventSink.publish({
          aggregateType: "sale",
          aggregateId: saleId,
          eventType: "sale.ended",
          payload: {
            from_status: sale.status,
            to_status: "ended",
            ...(reason ? { reason } : {}),
          },
          actorUserId: actorUserId ?? null,
        });
      }
    }

    const updatedSale = await this.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.lotRepo.findBySaleId(saleId);
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  setLotStatus(
    userRole: string,
    saleId: string,
    lotId: string,
    status: LotStatus,
    reason?: string,
    userStaffRole?: string | null,
  ) {
    return this.lotStatusAdmin.setLotStatus(userRole, saleId, lotId, status, reason, userStaffRole);
  }
}
