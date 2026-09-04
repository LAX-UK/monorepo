import { APIError } from "better-auth/api";
import type { SubjectStatusReader } from "./ports/subject-status-reader.js";

/** Rejects session creation when the global Identity account is disabled or retired. */
export async function assertUserNotSuspendedForSession(
  reader: SubjectStatusReader,
  userId: string,
): Promise<void> {
  if (await reader.isDisabledOrMerged(userId)) {
    throw new APIError("FORBIDDEN", {
      message: "Identity account disabled",
      code: "IDENTITY_DISABLED",
    });
  }
}
