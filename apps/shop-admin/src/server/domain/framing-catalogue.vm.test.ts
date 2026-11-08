import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_BLOCK_REASON,
  framingDetails,
  framingLeadTime,
  framingRowActions,
  framingUsedOn,
  pauseDescription,
  placeholderOptionCount,
  presentFramingStatus,
} from "./framing-catalogue.vm";

describe("framing catalogue view model", () => {
  it("reads an option's mount and glazing on one line", () => {
    expect(framingDetails({ mount: "window_conservation", glazing: "uv_acrylic" })).toBe(
      "Window mount, white conservation board · UV-filtering acrylic",
    );
  });

  it("reads the lead time as a range, or one number", () => {
    expect(framingLeadTime({ leadTimeMinDays: 10, leadTimeMaxDays: 15 })).toBe(
      "10 to 15 working days",
    );
    expect(framingLeadTime({ leadTimeMinDays: 7, leadTimeMaxDays: 7 })).toBe("7 working days");
  });

  it("says how many editions use an option, and nothing when none do", () => {
    expect(framingUsedOn({ editionCount: 0 })).toBeNull();
    expect(framingUsedOn({ editionCount: 1 })).toBe("1 edition");
    expect(framingUsedOn({ editionCount: 14 })).toBe("14 editions");
  });

  it("counts the options that still have placeholder prices", () => {
    expect(
      placeholderOptionCount([
        { pricesPlaceholder: true },
        { pricesPlaceholder: false },
        { pricesPlaceholder: true },
      ]),
    ).toBe(2);
  });

  it("names the three statuses in words", () => {
    expect(presentFramingStatus("draft").label).toBe("Draft");
    expect(presentFramingStatus("active").label).toBe("Offered");
    expect(presentFramingStatus("paused").label).toBe("Paused");
  });
});

describe("framingRowActions", () => {
  it("offers staff without edit rights nothing", () => {
    expect(
      framingRowActions({ status: "active", pricesPlaceholder: false }, { canEdit: false }),
    ).toEqual([]);
  });

  it("lets an active option be edited or paused", () => {
    expect(
      framingRowActions({ status: "active", pricesPlaceholder: false }, { canEdit: true }),
    ).toEqual([{ kind: "edit" }, { kind: "pause" }]);
  });

  it("lets a paused option be offered again", () => {
    expect(
      framingRowActions({ status: "paused", pricesPlaceholder: false }, { canEdit: true }),
    ).toEqual([{ kind: "edit" }, { kind: "offer" }]);
  });

  it("blocks offering a draft with placeholder prices, and says why", () => {
    expect(
      framingRowActions({ status: "draft", pricesPlaceholder: true }, { canEdit: true }),
    ).toEqual([{ kind: "edit" }, { kind: "offer", blockedReason: PLACEHOLDER_BLOCK_REASON }]);
  });
});

describe("pauseDescription", () => {
  it("says what pausing does when editions offer the option", () => {
    expect(pauseDescription({ editionCount: 3 })).toBe(
      "3 editions offer it. Shoppers stop seeing it at once. Baskets that already hold it keep it until checkout, and paid orders are not affected.",
    );
    expect(pauseDescription({ editionCount: 1 })).toMatch(/^1 edition offers it\./);
  });

  it("is lighter when none do", () => {
    expect(pauseDescription({ editionCount: 0 })).toMatch(/^No edition offers it yet\./);
  });
});
