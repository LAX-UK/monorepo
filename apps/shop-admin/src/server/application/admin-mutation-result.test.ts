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

  it("carries the current version of a row that someone else saved first", () => {
    expect(
      mapAdminMutationErrorBody(
        409,
        { message: "Exhibition was changed", currentVersion: "2026-03-01T11:30:00.000Z" },
        "x",
      ),
    ).toEqual({
      ok: false,
      kind: "conflict",
      message: "Exhibition was changed",
      currentVersion: "2026-03-01T11:30:00.000Z",
    });
  });

  it("lists the records a 422 says do not exist", () => {
    expect(
      mapAdminMutationErrorBody(422, { message: "Unknown ids", missingIds: ["a", "b"] }, "x"),
    ).toEqual({ ok: false, kind: "unknown_ids", message: "Unknown ids", missingIds: ["a", "b"] });
  });

  it("treats a 422 without missing ids as a plain failure", () => {
    expect(mapAdminMutationErrorBody(422, { message: "Nope" }, "x")).toEqual({
      ok: false,
      kind: "failed",
      message: "Nope",
    });
  });
});
