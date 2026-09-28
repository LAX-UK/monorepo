import { describe, expect, it } from "vitest";
import { parseConvertLeadContactId } from "./zoho-crm-convert-response.js";

describe("parseConvertLeadContactId", () => {
  it("reads contact id from details.Contacts.id", () => {
    const id = parseConvertLeadContactId(
      200,
      JSON.stringify({
        data: [{ details: { Contacts: { id: "contact-99" } } }],
      }),
    );
    expect(id).toBe("contact-99");
  });

  it("reads contact id from Contacts object shape", () => {
    const id = parseConvertLeadContactId(
      200,
      JSON.stringify({
        data: [{ Contacts: { id: "contact-88" } }],
      }),
    );
    expect(id).toBe("contact-88");
  });
});
