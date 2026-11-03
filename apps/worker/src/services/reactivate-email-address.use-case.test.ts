import { emailHash } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { IEmailProviderSuppression } from "../interfaces/email-provider-suppression.js";
import { reactivateEmailAddressUseCase } from "./reactivate-email-address.use-case.js";

const log = pino({ level: "silent" });
const EMAIL = "ana@example.com";
const JOB = { userId: "u1", emailHash: emailHash(EMAIL) };

function deps(email: string | null, provider: IEmailProviderSuppression) {
  return {
    addresses: { findEmail: async () => email },
    provider,
    streams: ["outbound", "broadcast"],
    log,
  };
}

describe("reactivateEmailAddressUseCase", () => {
  it("asks the provider on every stream", async () => {
    const reactivate = vi.fn().mockResolvedValue("reactivated");
    await reactivateEmailAddressUseCase(deps(EMAIL, { reactivate }), JOB);
    expect(reactivate.mock.calls).toEqual([
      [EMAIL, "outbound"],
      [EMAIL, "broadcast"],
    ]);
  });

  it("fails the job when the provider fails, so the queue retries it", async () => {
    const reactivate = vi.fn().mockRejectedValue(new Error("Postmark unavailable"));
    await expect(reactivateEmailAddressUseCase(deps(EMAIL, { reactivate }), JOB)).rejects.toThrow(
      "Postmark unavailable",
    );
  });

  it("does not retry a block the provider keeps, such as a spam complaint", async () => {
    const reactivate = vi.fn().mockResolvedValue("still_blocked");
    await expect(
      reactivateEmailAddressUseCase(deps(EMAIL, { reactivate }), JOB),
    ).resolves.toBeUndefined();
  });

  it("skips an address the person has since changed", async () => {
    const reactivate = vi.fn();
    await reactivateEmailAddressUseCase(deps("new@example.com", { reactivate }), JOB);
    await reactivateEmailAddressUseCase(deps(null, { reactivate }), JOB);
    expect(reactivate).not.toHaveBeenCalled();
  });
});
