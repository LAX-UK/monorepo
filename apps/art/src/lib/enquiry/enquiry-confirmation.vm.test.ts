import { describe, expect, it } from "vitest";
import { buildEnquiryConfirmation, enquiryConfirmationLead } from "./enquiry-confirmation.vm";

describe("buildEnquiryConfirmation", () => {
  it("lets signed-in collectors track the enquiry", () => {
    const vm = buildEnquiryConfirmation({ viewer: { kind: "authenticated" }, subject: "artwork" });
    expect(vm.followUp).toEqual({
      kind: "track",
      label: "Track this in Enquiries",
      href: "/account/enquiries",
    });
    expect(vm.steps.map((step) => step.title)).toEqual([
      "The gallery team reads your enquiry",
      "We answer your questions",
      "See it in person, if you like",
    ]);
  });

  it("invites guests to an account without promising to link this enquiry", () => {
    const vm = buildEnquiryConfirmation({
      viewer: { kind: "guest" },
      subject: "general",
      registerHref: "/register?returnTo=%2F",
    });
    expect(vm.followUp).toMatchObject({ kind: "account", href: "/register?returnTo=%2F" });
    expect(vm.followUp.kind === "account" && vm.followUp.note).not.toMatch(/this enquiry/);
  });

  it("does not repeat the visit step for a private viewing", () => {
    const vm = buildEnquiryConfirmation({ viewer: { kind: "guest" }, subject: "private_viewing" });
    expect(vm.steps.map((step) => step.title)).toEqual([
      "The gallery team reads your enquiry",
      "We suggest a time",
    ]);
  });

  it("lists the gallery's direct lines", () => {
    const vm = buildEnquiryConfirmation({ viewer: { kind: "guest" }, subject: "artwork" });
    expect(vm.details.map((detail) => detail.kind)).toContain("phone");
  });
});

describe("enquiryConfirmationLead", () => {
  it("names the reply address when there is one", () => {
    expect(enquiryConfirmationLead(" ana@example.com ")).toBe(
      "The gallery team will reply to ana@example.com within one working day.",
    );
    expect(enquiryConfirmationLead(null)).toBe(
      "The gallery team will reply within one working day.",
    );
  });
});
