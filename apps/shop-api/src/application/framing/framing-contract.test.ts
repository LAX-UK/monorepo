import {
  FRAMING_BAND_VALUES,
  FRAMING_FRAME_VALUES,
  FRAMING_GLAZING_VALUES,
  FRAMING_HANGING_VALUES,
  FRAMING_ISSUE_FIELDS,
  FRAMING_ISSUE_REASONS,
  FRAMING_MOUNT_VALUES,
  FRAMING_NAME_MAX,
  FRAMING_STATUS_VALUES,
} from "@auction/shop-contracts";
import {
  FRAMING_BAND_CODES,
  FRAMING_FRAMES,
  FRAMING_GLAZINGS,
  FRAMING_HANGINGS,
  FRAMING_MOUNTS,
  FRAMING_NAME_MAX_LENGTH,
  FRAMING_STATUSES,
  type FramingIssue,
  framingOptionIssues,
} from "@auction/shop-domain";
import { describe, expect, it } from "vitest";

describe("the framing contract and the domain rules", () => {
  it("list the same bands, frames, mounts, glazings, hangings and statuses", () => {
    expect([...FRAMING_BAND_VALUES]).toEqual([...FRAMING_BAND_CODES]);
    expect([...FRAMING_FRAME_VALUES]).toEqual([...FRAMING_FRAMES]);
    expect([...FRAMING_MOUNT_VALUES]).toEqual([...FRAMING_MOUNTS]);
    expect([...FRAMING_GLAZING_VALUES]).toEqual([...FRAMING_GLAZINGS]);
    expect([...FRAMING_HANGING_VALUES]).toEqual([...FRAMING_HANGINGS]);
    expect([...FRAMING_STATUS_VALUES]).toEqual([...FRAMING_STATUSES]);
    expect(FRAMING_NAME_MAX).toBe(FRAMING_NAME_MAX_LENGTH);
  });

  it("name every field and reason the rules can report", () => {
    const worst = framingOptionIssues({
      name: "",
      frame: "natural_oak",
      mount: "window_conservation",
      glazing: "uv_acrylic",
      hanging: "d_rings_cord",
      leadTimeMinDays: null,
      leadTimeMaxDays: null,
      pricesPence: { up_to_40x50: null, up_to_60x80: 0, up_to_80x100: 5 },
    });
    const reported: FramingIssue[] = [
      ...worst,
      { field: "offered", reason: "placeholder_prices" },
      { field: "name", reason: "name_too_long" },
      { field: "leadTimeMaxDays", reason: "lead_time_order" },
    ];
    for (const issue of reported) {
      expect(FRAMING_ISSUE_FIELDS as readonly string[]).toContain(issue.field);
      expect(FRAMING_ISSUE_REASONS as readonly string[]).toContain(issue.reason);
    }
  });
});
