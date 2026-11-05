import { describe, expect, it } from "vitest";
import { parseLeadRecord } from "./zoho-crm-lead-record.js";

describe("parseLeadRecord", () => {
  it("reads the owner and the converted contact", () => {
    const body = JSON.stringify({
      data: [
        {
          Owner: { id: "u1", name: "Kylie" },
          Converted_Detail: { contact: { id: "c9", name: "A B" }, account: { id: "a1" } },
        },
      ],
    });
    expect(parseLeadRecord(body)).toEqual({
      status: null,
      ownerId: "u1",
      convertedContactId: "c9",
    });
  });

  it("reports an unconverted, unassigned lead", () => {
    const body = JSON.stringify({ data: [{ Converted_Detail: null }] });
    expect(parseLeadRecord(body)).toEqual({
      status: null,
      ownerId: null,
      convertedContactId: null,
    });
  });

  it("returns null for an empty or invalid body", () => {
    expect(parseLeadRecord("")).toBeNull();
    expect(parseLeadRecord("{}")).toBeNull();
  });
});
