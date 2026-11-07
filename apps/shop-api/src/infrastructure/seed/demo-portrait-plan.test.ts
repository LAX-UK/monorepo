import { describe, expect, it } from "vitest";
import { isReplaceablePortrait, planDemoPortraits } from "./demo-portrait-plan.js";

const artist = (slug: string, portrait: string | null = null) => ({
  id: `id-${slug}`,
  slug,
  portrait,
});

describe("planDemoPortraits", () => {
  it("gives every artist without a portrait a different one", () => {
    const plan = planDemoPortraits(["a", "b", "c", "d"].map((slug) => artist(slug)));
    expect(plan).toHaveLength(4);
    expect(new Set(plan.map((p) => p.portrait)).size).toBe(4);
  });

  it("replaces the shared stand-in portraits", () => {
    const plan = planDemoPortraits([
      artist("a", "/art/seed/artist-juno.webp"),
      artist("b", "/art/seed/artist-juno.webp"),
    ]);
    expect(new Set(plan.map((p) => p.portrait)).size).toBe(2);
  });

  it("keeps a portrait an artist really has", () => {
    const plan = planDemoPortraits([
      artist("a", "https://media.example.com/real.jpg"),
      artist("b"),
    ]);
    expect(plan.map((p) => p.id)).toEqual(["id-b"]);
  });

  it("numbers by slug, so the result does not depend on row order and a re-run changes nothing", () => {
    const rows = [artist("c"), artist("a"), artist("b")];
    const first = planDemoPortraits(rows);
    expect(planDemoPortraits([...rows].reverse())).toEqual(first);
    const applied = rows.map((r) => ({
      ...r,
      portrait: first.find((p) => p.id === r.id)?.portrait ?? null,
    }));
    expect(planDemoPortraits(applied)).toEqual([]);
  });
});

describe("isReplaceablePortrait", () => {
  it("treats empty and seed paths as stand-ins", () => {
    expect(isReplaceablePortrait(null)).toBe(true);
    expect(isReplaceablePortrait("  ")).toBe(true);
    expect(isReplaceablePortrait("/shop/home/artist-juno.webp")).toBe(true);
    expect(
      isReplaceablePortrait(
        "https://lax-media.lon1.cdn.digitaloceanspaces.com/demo/portrait/x.jpg",
      ),
    ).toBe(true);
    expect(isReplaceablePortrait("uploads/artists/x.jpg")).toBe(false);
  });
});
