import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMarketingFormErrors } from "./use-marketing-form-errors.js";

const IDS = { name: "f-name", email: "f-email" } as const;

describe("useMarketingFormErrors", () => {
  it("lists messages in page order and counts each failed submit", () => {
    const { result } = renderHook(() => useMarketingFormErrors(IDS));
    act(() => result.current.fail({ email: "Enter your email address", name: "Enter your name" }));
    expect(result.current.summary).toEqual([
      { fieldId: "f-name", message: "Enter your name" },
      { fieldId: "f-email", message: "Enter your email address" },
    ]);
    expect(result.current.failedSubmits).toBe(1);
    act(() => result.current.fail({ email: "Enter your email address" }));
    expect(result.current.failedSubmits).toBe(2);
  });

  it("does not count a clean submit", () => {
    const { result } = renderHook(() => useMarketingFormErrors(IDS));
    act(() => result.current.fail({}));
    expect(result.current.failedSubmits).toBe(0);
    expect(result.current.summary).toEqual([]);
  });

  it("drops one field's message as it is edited, leaving the others", () => {
    const { result } = renderHook(() => useMarketingFormErrors(IDS));
    act(() => result.current.fail({ name: "Enter your name", email: "Enter your email address" }));
    act(() => result.current.clear("name"));
    expect(result.current.messages).toEqual({ email: "Enter your email address" });
    expect(result.current.failedSubmits).toBe(1);
  });

  describe("a form with one field", () => {
    const SINGLE = { email: "only-email" } as const;

    it("has no summary: the message belongs under the field", () => {
      const { result } = renderHook(() => useMarketingFormErrors(SINGLE));
      act(() => result.current.fail({ email: "Enter your email address" }));
      expect(result.current.summary).toEqual([]);
      expect(result.current.messages.email).toBe("Enter your email address");
    });

    it("moves focus to the field and leaves the announcing to its description", () => {
      const input = document.createElement("input");
      input.id = "only-email";
      const button = document.createElement("button");
      document.body.append(input, button);
      button.focus();
      const { result } = renderHook(() => useMarketingFormErrors(SINGLE));
      act(() => result.current.fail({ email: "Enter your email address" }));
      expect(document.activeElement).toBe(input);
      expect(result.current.announce).toBe(false);
      input.remove();
      button.remove();
    });

    it("announces the message itself when the field already had focus", () => {
      const input = document.createElement("input");
      input.id = "only-email";
      document.body.append(input);
      input.focus();
      const { result } = renderHook(() => useMarketingFormErrors(SINGLE));
      act(() => result.current.fail({ email: "Enter your email address" }));
      expect(result.current.announce).toBe(true);
      input.remove();
    });
  });
});
