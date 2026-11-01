import { describe, expect, it } from "vitest";
import { twoStepReminderRecipients } from "./two-step-reminder.js";

describe("twoStepReminderRecipients", () => {
  it("reminds members without two-step on, never the sender", () => {
    expect(
      twoStepReminderRecipients(
        [
          { userId: "maya", twoFactorEnabled: false },
          { userId: "tom", twoFactorEnabled: false },
          { userId: "sam", twoFactorEnabled: true },
          { userId: "lena", twoFactorEnabled: null },
          { userId: "tom", twoFactorEnabled: false },
        ],
        "maya",
      ),
    ).toEqual(["tom", "lena"]);
  });

  it("is empty when everyone else has it on", () => {
    expect(twoStepReminderRecipients([{ userId: "sam", twoFactorEnabled: true }], "maya")).toEqual(
      [],
    );
  });
});
