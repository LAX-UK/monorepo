import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /health/live", () => {
  it("returns ok without calling Shop API", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.release).toBe("string");
  });
});
