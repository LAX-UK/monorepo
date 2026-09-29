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

  it("keeps details.api_name as fieldApiName on error rows", () => {
    const rows = parseZohoRecordResponses(
      207,
      JSON.stringify({
        data: [
          {
            status: "error",
            code: "INVALID_DATA",
            message: "invalid value",
            details: { api_name: "Email" },
          },
        ],
      }),
    );
    expect(rows[0]?.fieldApiName).toBe("Email");
  });

  it("throws on hard HTTP errors", () => {
    expect(() => parseZohoRecordResponses(400, '{"code":"INVALID_REQUEST"}')).toThrow(
      ZohoCrmHttpError,
    );
  });
});
