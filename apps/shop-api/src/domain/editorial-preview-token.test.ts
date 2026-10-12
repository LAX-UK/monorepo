import { describe, expect, it } from "vitest";
import {
  signEditorialPreviewToken,
  verifyEditorialPreviewToken,
} from "./editorial-preview-token.js";

describe("editorial preview token", () => {
  it("round-trips a valid token", () => {
    const secret = "test-preview-secret-minimum-32-chars";
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signEditorialPreviewToken(secret, {
      entity: "page",
      id: "11111111-1111-4111-8111-111111111111",
      exp,
    });
    expect(verifyEditorialPreviewToken(secret, token)).toMatchObject({
      entity: "page",
      id: "11111111-1111-4111-8111-111111111111",
    });
  });
});
