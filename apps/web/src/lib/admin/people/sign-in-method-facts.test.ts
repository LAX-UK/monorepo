import { describe, expect, it } from "vitest";
import { signInMethodFacts } from "./sign-in-method-facts";

const labels = (items: ReturnType<typeof signInMethodFacts>) => items.map((item) => item.label);

describe("signInMethodFacts", () => {
  it("states each kind, with the passkey count when passkeys are offered", () => {
    const items = signInMethodFacts({ password: true, google: true, apple: false, passkeys: 2 });
    expect(items).toEqual([
      { label: "Password", value: "Set" },
      { label: "Google", value: "Linked" },
      { label: "Apple", value: "Not linked" },
      { label: "Passkeys", value: "2", numeric: true },
    ]);
  });

  it("shows nothing about passkeys when they are not offered", () => {
    const items = signInMethodFacts({
      password: false,
      google: false,
      apple: false,
      passkeys: null,
    });
    expect(labels(items)).toEqual(["Password", "Google", "Apple"]);
    expect(items[0]?.value).toBe("Not set");
  });

  it("shows zero passkeys when offered and none are held", () => {
    const items = signInMethodFacts({ password: true, google: false, apple: false, passkeys: 0 });
    expect(items.at(-1)).toEqual({ label: "Passkeys", value: "0", numeric: true });
  });

  it("says Not available when the issuer could not answer", () => {
    expect(signInMethodFacts(null)).toEqual([{ label: "Sign-in methods", value: "Not available" }]);
  });
});
