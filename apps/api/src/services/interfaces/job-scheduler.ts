/** BullMQ-backed scheduling for lot activate/end jobs (DIP for LotService / SaleService). */
export interface ILotJobScheduler {
  scheduleLot(lotId: string, startTime: Date, endTime: Date): Promise<void>;
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
  /** Remove only the scheduled end job (preserves activate jobs for not-yet-started lots). */
  cancelLotEndJob(lotId: string): Promise<void>;
}
