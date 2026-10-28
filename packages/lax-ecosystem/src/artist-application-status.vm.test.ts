import { describe, expect, it } from "vitest";
import {
  artistApplicationJourneyStep,
  presentArtistApplicationStatus,
} from "./artist-application-status.vm.js";

describe("artist application status for the artist", () => {
  it.each([
    ["submitted", "Submitted", "info"],
    ["in_review", "In review", "info"],
    ["more_info_needed", "More information needed", "attention"],
    ["accepted", "Accepted", "success"],
    ["declined", "Declined", "neutral"],
  ])("reads %s as %s", (status, label, tone) => {
    expect(presentArtistApplicationStatus(status)).toMatchObject({ label, tone });
  });

  it("writes every label in sentence case and every next step as a sentence", () => {
    for (const status of [
      "draft",
      "submitted",
      "in_review",
      "more_info_needed",
      "accepted",
      "declined",
    ]) {
      const vm = presentArtistApplicationStatus(status);
      expect(vm.label.slice(1)).toBe(vm.label.slice(1).toLowerCase());
      expect(vm.next.endsWith(".")).toBe(true);
    }
  });

  it("never shows a raw value for a status it does not know", () => {
    expect(presentArtistApplicationStatus("withdrawn").label).toBe("Submitted");
  });

  it("places an application on the journey", () => {
    expect(artistApplicationJourneyStep("submitted")).toBe(0);
    expect(artistApplicationJourneyStep("more_info_needed")).toBe(1);
    expect(artistApplicationJourneyStep("declined")).toBe(2);
  });
});
