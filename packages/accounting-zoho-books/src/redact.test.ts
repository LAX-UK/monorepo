import { describe, expect, it } from "vitest";
import { redactBody, redactLogFields, redactQuery, scrubText } from "./redact.js";

describe("redaction", () => {
  it("keeps only known-safe body fields and replaces personal data, even nested", () => {
    const out = JSON.stringify(
      redactBody({
        reference_number: "LAX-SHOP-INV-1",
        customer_name: "Ada Lovelace",
        email: "ada@example.com",
        billing_address: { address: "1 Analytical Way", city: "London" },
        contact_persons: [{ first_name: "Ada", phone: "07700900123" }],
        notes: "call her on 07700900123",
        line_items: [{ rate: 12.5, quantity: 1, description: "Oil painting of Ada" }],
        total: 15,
      }),
    );
    for (const leaked of ["Ada", "example.com", "Analytical", "07700900123", "painting"]) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain("LAX-SHOP-INV-1");
    expect(out).toContain("12.5");
  });

  it("drops secret-looking keys even when the name is otherwise safe", () => {
    const out = JSON.stringify(
      redactBody({ status: "ok", access_token: "abc", client_secret: "s" }),
    );
    expect(out).not.toContain("abc");
    expect(out).toContain("ok");
  });

  it("treats a string `code` (an OAuth grant code) as secret and a numeric one as safe", () => {
    expect(redactBody({ code: "1000.abc.def" })).toEqual({ code: "[redacted]" });
    expect(redactBody({ code: 3062 })).toEqual({ code: 3062 });
  });

  it("limits depth and width", () => {
    const deep = {
      invoices: [
        {
          invoices: [
            { invoices: [{ invoices: [{ invoices: [{ invoices: [{ invoices: [1] }] }] }] }] },
          ],
        },
      ],
    };
    expect(JSON.stringify(redactBody(deep))).toContain("[redacted]");
    const wide = redactBody({ invoices: Array.from({ length: 50 }, (_, i) => i) }) as {
      invoices: unknown[];
    };
    expect(wide.invoices).toHaveLength(21);
  });

  it("redacts query values it does not know", () => {
    expect(
      redactQuery({ search_text: "ada@example.com", page: 2, reference_number: "LAX-ART-INV-9" }),
    ).toEqual({
      search_text: "[redacted]",
      page: 2,
      reference_number: "LAX-ART-INV-9",
    });
  });

  it("scrubs tokens, emails and long numbers from free text", () => {
    const text = scrubText(
      "Authorization: Zoho-oauthtoken abc.def refresh_token=1000.aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb ada@example.com 07700900123",
    );
    for (const leaked of ["abc.def", "1000.aaaa", "ada@example.com", "07700900123"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("scrubs whatever a caller hands the logger", () => {
    const out = JSON.stringify(
      redactLogFields({
        error: "Bearer sometoken failed for bob@example.com",
        authorization: "x",
        nested: { password: "p" },
      }),
    );
    expect(out).not.toContain("sometoken");
    expect(out).not.toContain("bob@example.com");
    expect(out).not.toContain('"x"');
    expect(out).not.toContain('"p"');
  });
});
