import { describe, expect, it } from "vitest";
import { adminSaleroomCheckInBodySchema } from "./sale.js";

const ENTITY_ID = "00000000-0000-4000-8000-0000000000e1";

describe("adminSaleroomCheckInBodySchema", () => {
  it("accepts Better Auth opaque user ids (not UUID-shaped)", () => {
    const result = adminSaleroomCheckInBodySchema.safeParse({
      userId: "usr_8sK2xQ1aB9c",
      buyerLegalEntityId: ENTITY_ID,
      paddleNumber: 205,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe("usr_8sK2xQ1aB9c");
      expect(result.data.paddleNumber).toBe(205);
    }
  });

  it("rejects non-UUID buyerLegalEntityId", () => {
    const result = adminSaleroomCheckInBodySchema.safeParse({
      userId: "usr_8sK2xQ1aB9c",
      buyerLegalEntityId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });
});
