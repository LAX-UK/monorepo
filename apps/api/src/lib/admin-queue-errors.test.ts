import { describe, expect, it } from "vitest";
import {
  mapPauseError,
  mapReplayError,
  mapResumeError,
  mapRetryError,
} from "./admin-queue-errors.js";

describe("admin queue error mapping", () => {
  it("masks unknown retry errors", () => {
    const { error, status } = mapRetryError(new Error("ECONNREFUSED redis"));
    expect(error).toBe("retry_failed");
    expect(status).toBe(400);
  });

  it("maps job_not_found to 404", () => {
    const { error, status } = mapRetryError(new Error("job_not_found"));
    expect(error).toBe("job_not_found");
    expect(status).toBe(404);
  });

  it("maps already_replayed to 409", () => {
    const { error, status } = mapReplayError(new Error("already_replayed"));
    expect(error).toBe("already_replayed");
    expect(status).toBe(409);
  });

  it("maps dlq_job_not_found to 404", () => {
    const { error, status } = mapReplayError(new Error("dlq_job_not_found"));
    expect(error).toBe("dlq_job_not_found");
    expect(status).toBe(404);
  });

  it("masks malformed payload parse failures", () => {
    const { error } = mapReplayError(new Error("invalid_payload"));
    expect(error).toBe("invalid_payload");
  });

  it("maps resume pause_not_allowed to 403", () => {
    const { error, status } = mapResumeError(new Error("pause_not_allowed"));
    expect(error).toBe("pause_not_allowed");
    expect(status).toBe(403);
  });

  it("masks unknown pause errors", () => {
    const { error } = mapPauseError(new Error("WRONGTYPE Operation against a key"));
    expect(error).toBe("pause_failed");
  });
});
