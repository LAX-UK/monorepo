import { contrastRatio, parseHex } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const WHITE = [255, 255, 255] as const;

describe("lot plate field", () => {
  it("averages the darkest pixels of a preview", async () => {
    const { deepestOfRgb } = await import("./lot-plate-field.server");
    const raw = Uint8Array.from([250, 250, 250, 10, 20, 30, 12, 22, 32, 240, 240, 240]);
    const [r, g, b] = deepestOfRgb(raw) ?? [];
    expect(r).toBeLessThan(20);
    expect(g).toBeLessThan(30);
    expect(b).toBeLessThan(40);
    expect(deepestOfRgb(new Uint8Array())).toBeNull();
  });

  it("falls back to a field white type passes on when there is no preview", async () => {
    const { DEFAULT_PLATE_FIELD, plateFieldFromPreview } = await import("./lot-plate-field.server");
    expect(await plateFieldFromPreview(undefined)).toBe(DEFAULT_PLATE_FIELD);
    expect(await plateFieldFromPreview("data:image/jpeg;base64,not-an-image")).toBe(
      DEFAULT_PLATE_FIELD,
    );
    expect(contrastRatio(WHITE, parseHex(DEFAULT_PLATE_FIELD))).toBeGreaterThanOrEqual(13);
  });
});
