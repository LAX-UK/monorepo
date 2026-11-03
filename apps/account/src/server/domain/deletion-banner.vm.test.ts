import { describe, expect, it } from "vitest";
import { buildDeletionBannerVm } from "./deletion-banner.vm";

describe("buildDeletionBannerVm", () => {
  it("names the day the account is erased, thirty days after the request", () => {
    expect(buildDeletionBannerVm({ deletionRequestedAt: "2026-11-02T10:00:00.000Z" })).toEqual({
      dueOn: "2 December",
    });
  });

  it("shows nothing when no deletion is scheduled or the issuer could not answer", () => {
    expect(buildDeletionBannerVm({ deletionRequestedAt: null })).toBeNull();
    expect(buildDeletionBannerVm({})).toBeNull();
    expect(buildDeletionBannerVm(null)).toBeNull();
  });
});
