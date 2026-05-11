import { describe, expect, it } from "vitest";
import { JsonErrorResponseBuilder } from "./json-error-response.builder.js";

describe("JsonErrorResponseBuilder", () => {
  it("includes stable code when classifier set one", async () => {
    const builder = new JsonErrorResponseBuilder();
    const res = builder.build({
      message: "Database schema is not up to date.",
      status: 503,
      code: "database_schema_incomplete",
      severity: "error",
    });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "Database schema is not up to date.",
      code: "database_schema_incomplete",
    });
  });
});
