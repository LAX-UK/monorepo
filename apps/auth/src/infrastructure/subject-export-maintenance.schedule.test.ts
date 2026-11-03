import { describe, expect, it, vi } from "vitest";
import { ALERTING_LOG_MESSAGES } from "./alerting-log.js";
import {
  SUBJECT_EXPORT_DEADLINE_ALERTS,
  runSubjectExportMaintenance,
} from "./subject-export-maintenance.schedule.js";

const row = {
  id: "e1",
  status: "delayed",
  requestedAt: new Date("2026-10-01T00:00:00.000Z"),
  dueAt: new Date("2026-11-01T00:00:00.000Z"),
  lastErrorCode: "timeout",
};

describe("runSubjectExportMaintenance", () => {
  it("expires copies, then logs each newly overdue request at its tier's level", async () => {
    const service = {
      expireDue: vi.fn(async () => 2),
      claimDeadlineAlerts: vi.fn(async () => [
        { row: { ...row, id: "a" }, tier: 1 },
        { row: { ...row, id: "b" }, tier: 2 },
        { row: { ...row, id: "c" }, tier: 3 },
      ]),
    };
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(await runSubjectExportMaintenance(service as never, log)).toEqual({
      expired: 2,
      alerts: 3,
    });
    expect(log.warn).toHaveBeenCalledWith(
      {
        exportId: "a",
        status: "delayed",
        requestedAt: "2026-10-01T00:00:00.000Z",
        dueAt: "2026-11-01T00:00:00.000Z",
        lastErrorCode: "timeout",
      },
      "subject_export_overdue_24h",
    );
    expect(log.error.mock.calls.map(([, message]) => message)).toEqual([
      "subject_export_overdue_7d",
      "subject_export_overdue_21d",
    ]);
  });

  it("logs nothing when nothing is overdue", async () => {
    const service = { expireDue: vi.fn(async () => 0), claimDeadlineAlerts: vi.fn(async () => []) };
    const log = { warn: vi.fn(), error: vi.fn() };
    await runSubjectExportMaintenance(service as never, log);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("only uses messages the alert rules match on", () => {
    for (const { message } of Object.values(SUBJECT_EXPORT_DEADLINE_ALERTS)) {
      expect(ALERTING_LOG_MESSAGES).toContain(message);
    }
  });
});
