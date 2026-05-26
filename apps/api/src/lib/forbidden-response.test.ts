import { describe, expect, it } from "vitest";
import { LotError } from "./errors.js";
import { serviceErrorJsonBody } from "./forbidden-response.js";

describe("serviceErrorJsonBody", () => {
  it("includes LotError code when present", () => {
    expect(
      serviceErrorJsonBody(new LotError("Use Return to inventory", 422, "use_return_to_inventory")),
    ).toEqual({
      error: "Use Return to inventory",
      code: "use_return_to_inventory",
    });
  });
});
