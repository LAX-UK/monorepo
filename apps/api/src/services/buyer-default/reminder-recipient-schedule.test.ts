import { reminderClosesAt, reminderSendAt } from "@auction/domain";
import type { IRecipientZoneReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { stageForRecipientsDue } from "./reminder-recipient-schedule.js";

/** 29 March 2026 is London's 23-hour spring-forward day; due at the end of it. */
const dueAt = new Date("2026-03-29T22:59:59.999Z");

function zonesOf(map: Record<string, string>): IRecipientZoneReader {
  return { zonesFor: vi.fn(async () => new Map(Object.entries(map))) };
}

describe("stageForRecipientsDue window close", () => {
  for (const zone of ["Australia/Adelaide", "Australia/Brisbane"]) {
    it(`stages nothing and takes the step once the window closed (${zone})`, async () => {
      const stage = vi.fn(async () => {});
      const now = new Date(reminderClosesAt("due_day", dueAt).getTime() + 1);
      const result = await stageForRecipientsDue({
        recipients: ["u1", "u2"],
        zones: zonesOf({ u1: zone }),
        dueAt,
        step: "due_day",
        now,
        stage,
      });
      expect(stage).not.toHaveBeenCalled();
      expect(result).toEqual({ everyoneStaged: true, windowClosed: true });
    });

    it(`still stages at the last instant of the window (${zone})`, async () => {
      const stage = vi.fn(async () => {});
      const now = reminderClosesAt("due_day", dueAt);
      expect(reminderSendAt("due_day", dueAt, zone).getTime()).toBeLessThanOrEqual(now.getTime());
      const result = await stageForRecipientsDue({
        recipients: ["u1"],
        zones: zonesOf({ u1: zone }),
        dueAt,
        step: "due_day",
        now,
        stage,
      });
      expect(stage).toHaveBeenCalledWith("u1");
      expect(result).toEqual({ everyoneStaged: true, windowClosed: false });
    });
  }
});
