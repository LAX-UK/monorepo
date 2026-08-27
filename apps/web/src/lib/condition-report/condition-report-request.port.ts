import type { ConditionReportRequestSnapshot } from "@/lib/condition-report/condition-report-types";

export type ConditionReportRequestPort = {
  getForLot(lotId: string): Promise<ConditionReportRequestSnapshot | null>;
  submit(
    lotId: string,
    requestNote: string,
  ): Promise<{ ok: true; row: ConditionReportRequestSnapshot } | { ok: false; message: string }>;
};
