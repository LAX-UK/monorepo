import { describe, expect, it } from "vitest";
import {
  contactDetailsForm,
  contactDetailsInput,
  validateContactDetails,
  websiteLabel,
} from "./contact-details.vm";

const view = {
  email: "hello@northbank.gallery",
  phone: null,
  website: "https://northbank.gallery",
  updatedAt: null,
  canEdit: true,
};

describe("contact details form", () => {
  it("starts from the saved details, empty for none", () => {
    expect(contactDetailsForm(view)).toEqual({
      email: "hello@northbank.gallery",
      phone: "",
      website: "https://northbank.gallery",
    });
  });

  it("sends trimmed values; empty means none", () => {
    expect(
      contactDetailsInput({ email: " a@b.example ", phone: " ", website: "x.example" }),
    ).toEqual({ email: "a@b.example", phone: "", website: "x.example" });
  });

  it("checks each field with the API's rules, in words", () => {
    expect(validateContactDetails({ email: "", phone: "", website: "" })).toEqual({});
    expect(
      validateContactDetails({ email: "nope", phone: "call us", website: "javascript:alert(1)" }),
    ).toEqual({
      email: "Enter an email address like name@example.com",
      phone: "Enter a phone number using digits, spaces and +",
      website: "Enter a web address like example.com",
    });
  });
});

describe("websiteLabel", () => {
  it("reads a web address the way people say it", () => {
    expect(websiteLabel("https://northbank.gallery")).toBe("northbank.gallery");
    expect(websiteLabel("http://northbank.gallery/visit/")).toBe("northbank.gallery/visit");
  });
});
