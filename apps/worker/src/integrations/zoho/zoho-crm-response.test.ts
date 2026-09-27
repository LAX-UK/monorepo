import { describe, expect, it } from "vitest";
import { ZohoCrmHttpError } from "./types.js";
import { parseZohoRecordResponses } from "./zoho-crm-response.js";

describe("parseZohoRecordResponses", () => {
  it("treats 207 partial success per record", () => {
    const rows = parseZohoRecordResponses(
      207,
      JSON.stringify({
        data: [
          { status: "success", details: { id: "1" }, code: "SUCCESS" },
          { status: "error", code: "MANDATORY_NOT_FOUND", message: "missing" },
        ],
      }),
    );
    expect(rows[0]?.status).toBe("success");
    expect(rows[1]?.status).toBe("error");
  });

  it("throws on hard HTTP errors", () => {
    expect(() => parseZohoRecordResponses(400, '{"code":"INVALID_REQUEST"}')).toThrow(
      ZohoCrmHttpError,
    );
  });
});
