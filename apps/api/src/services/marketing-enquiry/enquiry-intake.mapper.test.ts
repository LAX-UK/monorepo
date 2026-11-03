import { enquiryIntakeSchema } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { toNewEnquiry } from "./enquiry-intake.mapper.js";

const parse = (body: unknown) => enquiryIntakeSchema.parse(body);
const person = { name: "Ada Lovelace", email: "ada@example.com" };

describe("toNewEnquiry", () => {
  it("summarises a seller's work for the list and keeps their notes below it", () => {
    const enquiry = toNewEnquiry(
      parse({
        ...person,
        intent: "private_sale_sell",
        departmentSlug: "paintings",
        artist: "David Hockney",
        title: "Pool study",
        locationTown: "Bath",
        locationCountry: "United Kingdom",
        message: "Signed on the back.",
      }),
    );
    expect(enquiry.message).toBe(
      "Selling privately: David Hockney, Pool study\n\nSigned on the back.",
    );
    expect(enquiry).toMatchObject({ topic: "selling", intent: "private_sale_sell" });
  });

  it("summarises a buyer's wish with the budget in words", () => {
    const enquiry = toNewEnquiry(
      parse({
        ...person,
        intent: "private_sale_buy",
        lookingFor: "A Bridget Riley",
        budgetBand: "over_250000",
        timing: "no_rush",
      }),
    );
    expect(enquiry.message).toBe("Buying privately: A Bridget Riley (over £250,000)");
    expect(enquiry.departmentSlug).toBeUndefined();
  });

  it("leaves a general message as it was written", () => {
    const enquiry = toNewEnquiry(
      parse({ ...person, topic: "other", message: "Where is the saleroom?" }),
    );
    expect(enquiry).toMatchObject({
      intent: "general",
      topic: "other",
      message: "Where is the saleroom?",
    });
  });
});
