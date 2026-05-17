import { describe, expect, it } from "vitest";
import { AuthzError, missingCatalogueCapabilityError } from "./errors.js";
import { authzErrorJsonBody, missingCapabilityBody } from "./forbidden-response.js";

describe("forbidden-response", () => {
  it("missingCapabilityBody returns structured envelope", () => {
    const body = missingCapabilityBody("nope", ["catalogue.write"], {
      role: "staff",
      staffRole: null,
    });
    expect(body).toEqual({
      error: "nope",
      code: "missing_capability",
      required: ["catalogue.write"],
      actor: { role: "staff", staffRole: null },
    });
  });

  it("authzErrorJsonBody includes metadata for catalogue capability errors", () => {
    const err = missingCatalogueCapabilityError("Only staff", "staff", null);
    expect(authzErrorJsonBody(err)).toMatchObject({
      code: "missing_capability",
      required: ["auction.manage", "catalogue.write"],
      actor: { role: "staff", staffRole: null },
    });
  });

  it("authzErrorJsonBody falls back to message-only for plain AuthzError", () => {
    expect(authzErrorJsonBody(new AuthzError("Forbidden", 403))).toEqual({ error: "Forbidden" });
  });
});
