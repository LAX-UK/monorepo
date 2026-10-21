import { describe, expect, it } from "vitest";
import {
  dismissCompleteAccountPrompt,
  isCompleteAccountPromptDismissed,
} from "./complete-account-dismissal";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("complete account prompt dismissal", () => {
  it("remembers a dismissal for the same gaps", () => {
    const storage = memoryStorage();
    expect(isCompleteAccountPromptDismissed(storage, "phone")).toBe(false);
    dismissCompleteAccountPrompt(storage, "phone");
    expect(isCompleteAccountPromptDismissed(storage, "phone")).toBe(true);
  });

  it("shows the prompt again when a different detail goes missing", () => {
    const storage = memoryStorage();
    dismissCompleteAccountPrompt(storage, "phone");
    expect(isCompleteAccountPromptDismissed(storage, "name,phone")).toBe(false);
  });

  it("treats missing or blocked storage as not dismissed", () => {
    expect(isCompleteAccountPromptDismissed(null, "phone")).toBe(false);
    expect(isCompleteAccountPromptDismissed(throwing, "phone")).toBe(false);
    expect(() => dismissCompleteAccountPrompt(throwing, "phone")).not.toThrow();
  });
});
