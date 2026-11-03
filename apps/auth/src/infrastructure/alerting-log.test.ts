import { describe, expect, it, vi } from "vitest";
import { withAlertingLog } from "./alerting-log.js";

function setup() {
  const log = { warn: vi.fn(), error: vi.fn() };
  const capture = vi.fn();
  return { log, capture, wrapped: withAlertingLog(log, capture) };
}

describe("withAlertingLog", () => {
  it("logs everything and mirrors only the alerting messages", () => {
    const { log, capture, wrapped } = setup();

    wrapped.error({ effect: "revoke_subject_tokens" }, "auth_security_effect_abandoned");
    wrapped.warn({}, "rate_limit_redis_unavailable_using_in_process_fallback");
    wrapped.error({}, "auth_security_effect_failed");
    wrapped.warn({}, "auth_security_effect_recovered");
    wrapped.warn({ exportId: "e1" }, "subject_export_overdue_24h");
    wrapped.error({ exportId: "e1" }, "subject_export_overdue_7d");
    wrapped.error({ exportId: "e1" }, "subject_export_overdue_21d");

    expect(log.error).toHaveBeenCalledTimes(4);
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(capture.mock.calls).toEqual([
      ["auth_security_effect_abandoned", { effect: "revoke_subject_tokens" }, "error"],
      ["rate_limit_redis_unavailable_using_in_process_fallback", {}, "warning"],
      ["subject_export_overdue_24h", { exportId: "e1" }, "warning"],
      ["subject_export_overdue_7d", { exportId: "e1" }, "error"],
      ["subject_export_overdue_21d", { exportId: "e1" }, "error"],
    ]);
  });
});
