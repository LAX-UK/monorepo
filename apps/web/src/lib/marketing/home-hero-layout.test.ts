import { HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { describe, expect, it } from "vitest";

describe("HOME_HERO_MIN_H", () => {
  it("uses full viewport height below lg", () => {
    expect(HOME_HERO_MIN_H).toContain("100svh");
    expect(HOME_HERO_MIN_H).toContain("100dvh");
  });

  it("caps height on lg+ to reduce horizontal crop on wide masters", () => {
    expect(HOME_HERO_MIN_H).toContain("lg:min-h-[clamp(520px,60vh,720px)]");
    expect(HOME_HERO_MIN_H).toContain(
      "lg:supports-[height:100dvh]:min-h-[clamp(520px,60dvh,720px)]",
    );
  });
});
