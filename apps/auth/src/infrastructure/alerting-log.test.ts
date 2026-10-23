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

    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls).toEqual([
      ["auth_security_effect_abandoned", { effect: "revoke_subject_tokens" }, "error"],
      ["rate_limit_redis_unavailable_using_in_process_fallback", {}, "warning"],
    ]);
  });
});
