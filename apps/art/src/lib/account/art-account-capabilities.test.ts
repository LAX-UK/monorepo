import { describe, expect, it } from "vitest";
import { artAccountCapabilitiesFrom, holdsCapability } from "./art-account-capabilities";

const access = (payouts: boolean) => ({
  status: "ok" as const,
  data: { editions: false, payouts, artist: false },
});

describe("artAccountCapabilitiesFrom", () => {
  it("reads payouts from the person's seller records", () => {
    expect(artAccountCapabilitiesFrom(access(true))).toEqual({ receivesPayouts: "yes" });
    expect(artAccountCapabilitiesFrom(access(false))).toEqual({ receivesPayouts: "no" });
  });

  it("treats seller tools switched off as none", () => {
    expect(artAccountCapabilitiesFrom({ status: "commerce_unavailable" })).toEqual({
      receivesPayouts: "no",
    });
  });

  it("does not know when the lookup failed or the session lapsed", () => {
    expect(artAccountCapabilitiesFrom({ status: "failed" })).toEqual({
      receivesPayouts: "unknown",
    });
    expect(artAccountCapabilitiesFrom({ status: "unauthorized" })).toEqual({
      receivesPayouts: "unknown",
    });
  });
});

describe("holdsCapability", () => {
  it("holds only on a definite yes", () => {
    expect(holdsCapability({ receivesPayouts: "yes" }, "receivesPayouts")).toBe(true);
    expect(holdsCapability({ receivesPayouts: "unknown" }, "receivesPayouts")).toBe(false);
    expect(holdsCapability({ receivesPayouts: "no" }, "receivesPayouts")).toBe(false);
  });
});
