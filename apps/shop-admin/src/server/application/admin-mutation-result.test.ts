import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { mapAdminMutationErrorBody } from "./admin-mutation-result.js";

describe("mapAdminMutationErrorBody", () => {
  it("maps step-up required", () => {
    expect(
      mapAdminMutationErrorBody(403, { code: SHOP_API_ERROR_CODES.STEP_UP_REQUIRED }, "x"),
    ).toEqual({
      ok: false,
      kind: "step_up_required",
      message: "Sign in again with step-up to continue.",
    });
  });

  it("maps conflict with message", () => {
    expect(mapAdminMutationErrorBody(409, { message: "Already pending" }, "x")).toEqual({
      ok: false,
      kind: "conflict",
      message: "Already pending",
    });
  });
});
