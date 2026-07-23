import { describe, expect, it } from "vitest";
import { composeLotAttention } from "./compose-lot-attention.js";
import { DEFAULT_LOT_ATTENTION_CONTRIBUTORS } from "./lot-attention-registry.js";
import type { LotAttentionSignals } from "./lot-attention-types.js";

const principal = { role: "staff" as const, staffRole: "super_admin" };

describe("composeLotAttention", () => {
  it("returns empty when lot is missing", () => {
    const result = composeLotAttention({ lot: null }, DEFAULT_LOT_ATTENTION_CONTRIBUTORS, {
      principal,
    });
    expect(result.items).toEqual([]);
  });

  it("flags draft lot missing photos and incomplete setup", () => {
    const signals: LotAttentionSignals = {
      lot: {
        id: "lot-1",
        status: "draft",
        title: "Test lot",
        images: [],
        description: "",
      },
      publishReadinessPercent: 40,
    };
    const result = composeLotAttention(signals, DEFAULT_LOT_ATTENTION_CONTRIBUTORS, { principal });
    expect(result.items.map((i) => i.kind)).toEqual(
      expect.arrayContaining(["setup_readiness", "missing_photos"]),
    );
  });

  it("flags connect required on scheduled lot", () => {
    const signals: LotAttentionSignals = {
      lot: {
        id: "lot-2",
        status: "scheduled",
        title: "Scheduled",
        images: ["img.jpg"],
      },
      connectRequired: true,
    };
    const result = composeLotAttention(signals, DEFAULT_LOT_ATTENTION_CONTRIBUTORS, { principal });
    expect(result.items.some((i) => i.kind === "connect_required")).toBe(true);
  });
});
