import { describe, expect, it } from "vitest";
import { hydrationErrors, isHydrationError } from "./hydration-errors";

describe("isHydrationError", () => {
  it("recognises the minified codes of a production build", () => {
    expect(
      isHydrationError("Error: Minified React error #418; visit https://react.dev/errors/418"),
    ).toBe(true);
    expect(isHydrationError("Minified React error #423")).toBe(true);
    expect(isHydrationError("Minified React error #425; visit ...")).toBe(true);
  });

  it("recognises the sentences of a development build", () => {
    expect(isHydrationError("Hydration failed because the server rendered text didn't match")).toBe(
      true,
    );
    expect(isHydrationError("Warning: Text content does not match server-rendered HTML.")).toBe(
      true,
    );
    expect(isHydrationError("There was an error while hydrating this Suspense boundary.")).toBe(
      true,
    );
  });

  it("leaves other errors alone", () => {
    expect(isHydrationError("Minified React error #4180")).toBe(false);
    expect(isHydrationError("Minified React error #200")).toBe(false);
    expect(isHydrationError("Failed to load resource: 404")).toBe(false);
  });
});

describe("hydrationErrors", () => {
  it("keeps only the hydration errors, in order", () => {
    const messages = ["404", "Minified React error #418", "warn", "Hydration failed because x"];
    expect(hydrationErrors(messages)).toEqual([
      "Minified React error #418",
      "Hydration failed because x",
    ]);
  });
});
