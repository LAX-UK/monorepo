import { describe, expect, it } from "vitest";
import { LEGAL_ACCEPTANCE_FIELD, signUpLegalAcceptance } from "./legal-acceptance.js";

const field = (product: unknown) => ({ [LEGAL_ACCEPTANCE_FIELD]: { product } });

describe("signUpLegalAcceptance", () => {
  it("reads the product from the email sign-up body", () => {
    expect(
      signUpLegalAcceptance("u1", { path: "/sign-up/email", body: field("shop") }, null),
    ).toEqual({ subjectId: "u1", product: "shop", source: "hosted_sign_up" });
  });

  it("reads the product from the state a social sign-up carried through the provider", () => {
    expect(signUpLegalAcceptance("u1", { path: "/callback/google" }, field("art"))).toEqual({
      subjectId: "u1",
      product: "art",
      source: "social_sign_up",
    });
  });

  it.each(["bid", "account", "shop", "art"])("accepts the %s product", (product) => {
    expect(
      signUpLegalAcceptance("u1", { path: "/sign-up/email", body: field(product) }, null)?.product,
    ).toBe(product);
  });

  it.each([
    ["no product", { path: "/sign-up/email", body: {} }, null],
    ["an unknown product", { path: "/sign-up/email", body: field("other") }, null],
    ["a product that is not text", { path: "/sign-up/email", body: field(7) }, null],
    ["no request context", null, null],
    ["a provider callback without the statement", { path: "/callback/google" }, null],
    ["an unknown product in provider state", { path: "/callback/google" }, field("other")],
    // The email form's field is only honoured on the email sign-up route.
    ["the field on another route", { path: "/sign-in/email", body: field("shop") }, null],
  ])("records nothing for %s", (_name, context, state) => {
    expect(signUpLegalAcceptance("u1", context, state)).toBeNull();
  });
});
