import { describe, expect, it } from "vitest";
import { classifyDeliveryError, formatDeliveryError } from "../../lib/delivery-retry.js";
import { mapZohoErrorToCrmGatewayError } from "./map-zoho-to-crm-gateway-error.js";
import { ZohoCrmHttpError } from "./types.js";
import { readZohoErrorDetail } from "./zoho-crm-error-detail.js";

const PERSON_EMAIL = "lena@example.test";

/** Zoho's per-record shape: a single refused record comes back with HTTP 400 and `data[]`. */
function recordError(code: string, details: Record<string, unknown>, message: string): string {
  return JSON.stringify({ data: [{ code, details, message, status: "error" }] });
}

const INVALID_PICKLIST = recordError(
  "INVALID_DATA",
  { expected_data_type: "picklist", api_name: "Lead_Source", json_path: "$.data[0].Lead_Source" },
  "invalid data",
);
const MISSING_LAST_NAME = recordError(
  "MANDATORY_NOT_FOUND",
  { api_name: "Last_Name", json_path: "$.data[0].Last_Name" },
  "required field not found",
);
const DUPLICATE_EMAIL = recordError(
  "DUPLICATE_DATA",
  {
    api_name: "Email",
    json_path: "$.data[0].Email",
    duplicate_record: { id: "5843000000000001", module: { api_name: "Leads" } },
  },
  `duplicate data: ${PERSON_EMAIL}`,
);
/** Zoho's whole-request shape (v2 and v8), e.g. a bad `duplicate_check_fields`. */
const REQUEST_LEVEL = JSON.stringify({
  code: "INVALID_DATA",
  details: { api_name: "duplicate_check_fields" },
  message: "invalid data",
  status: "error",
});

describe("readZohoErrorDetail", () => {
  it.each([
    [INVALID_PICKLIST, { code: "INVALID_DATA", fieldApiName: "Lead_Source" }],
    [MISSING_LAST_NAME, { code: "MANDATORY_NOT_FOUND", fieldApiName: "Last_Name" }],
    [DUPLICATE_EMAIL, { code: "DUPLICATE_DATA", fieldApiName: "Email" }],
    [REQUEST_LEVEL, { code: "INVALID_DATA", fieldApiName: "duplicate_check_fields" }],
  ])("reads the code and the field Zoho named", (body, expected) => {
    expect(readZohoErrorDetail(body)).toEqual(expected);
  });

  it("reads the column a COQL refusal names", () => {
    const body = JSON.stringify({
      code: "INVALID_QUERY",
      details: { column_name: "Email", reason: "column given seems to be invalid" },
      message: "Invalid query formed",
      status: "error",
    });
    expect(readZohoErrorDetail(body)).toEqual({ code: "INVALID_QUERY", fieldApiName: "Email" });
  });

  it("keeps the code alone when no field is named", () => {
    const body = JSON.stringify({ code: "INVALID_REQUEST", details: {}, status: "error" });
    expect(readZohoErrorDetail(body)).toEqual({ code: "INVALID_REQUEST" });
  });

  it("keeps nothing it does not recognise as a code or an API name", () => {
    expect(readZohoErrorDetail("<html>Bad Request</html>")).toEqual({});
    expect(readZohoErrorDetail(JSON.stringify({ code: "bad code with spaces" }))).toEqual({});
    const echoed = JSON.stringify({
      code: "INVALID_DATA",
      details: { api_name: PERSON_EMAIL },
      status: "error",
    });
    expect(readZohoErrorDetail(echoed)).toEqual({ code: "INVALID_DATA" });
  });
});

describe("ZohoCrmHttpError reason", () => {
  it("records Zoho's code and field for a 400, as the delivery stores it", () => {
    const err = new ZohoCrmHttpError(400, INVALID_PICKLIST);
    expect(err.message).toBe("zoho_crm_http_400:INVALID_DATA:Lead_Source");
    expect(err.zohoCode).toBe("INVALID_DATA");
    expect(err.fieldApiName).toBe("Lead_Source");

    const mapped = mapZohoErrorToCrmGatewayError(err);
    expect(formatDeliveryError(mapped)).toBe("zoho_crm_http_400:INVALID_DATA:Lead_Source");
    expect(mapped.code).toBe("INVALID_DATA");
    expect(mapped.fieldApiName).toBe("Lead_Source");
    expect(classifyDeliveryError(mapped)).toBe("fatal");
  });

  it("never carries the values or Zoho's message into the reason", () => {
    const err = new ZohoCrmHttpError(400, DUPLICATE_EMAIL);
    expect(err.message).toBe("zoho_crm_http_400:DUPLICATE_DATA:Email");
    expect(err.message).not.toContain(PERSON_EMAIL);
    expect(err.message).not.toContain("duplicate data");
  });

  it("keeps the bare status when the body says nothing usable, and for 5xx", () => {
    expect(new ZohoCrmHttpError(400, "not json").message).toBe("zoho_crm_http_400");
    expect(new ZohoCrmHttpError(503, REQUEST_LEVEL).message).toBe("zoho_crm_http_503");
  });

  it("still retries a 5xx and a 429", () => {
    expect(
      classifyDeliveryError(mapZohoErrorToCrmGatewayError(new ZohoCrmHttpError(503, ""))),
    ).toBe("retryable");
    expect(
      classifyDeliveryError(mapZohoErrorToCrmGatewayError(new ZohoCrmHttpError(429, ""))),
    ).toBe("retryable");
  });
});
