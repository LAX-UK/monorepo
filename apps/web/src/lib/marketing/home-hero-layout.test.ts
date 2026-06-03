import { HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { describe, expect, it } from "vitest";

describe("HOME_HERO_MIN_H", () => {
  it("uses full viewport height on all devices", () => {
    expect(HOME_HERO_MIN_H).toContain("100svh");
    expect(HOME_HERO_MIN_H).toContain("100dvh");
  });
});
