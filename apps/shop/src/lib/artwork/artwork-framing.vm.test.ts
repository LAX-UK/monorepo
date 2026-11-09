import type { PublicEditionFraming, PublicFramingOption } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { choiceById, presentArtworkFraming } from "./artwork-framing.vm";

const OAK = "00000000-0000-4000-8000-0000000000a1";
const BLACK = "00000000-0000-4000-8000-0000000000a2";

const option = (id: string, name: string, overrides: Partial<PublicFramingOption> = {}) =>
  ({
    id,
    name,
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    pricePence: 21000,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    ...overrides,
  }) satisfies PublicFramingOption;

const choose = (options: PublicFramingOption[], required = false): PublicEditionFraming => ({
  kind: "choose",
  required,
  description: null,
  options,
});

// A Monday, so working-day arithmetic is easy to follow.
const NOW = new Date("2026-11-02T10:00:00.000Z");
const TIMES = { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } };

const present = (framing: PublicEditionFraming) =>
  presentArtworkFraming({ framing, printPricePence: 18000, now: NOW, times: TIMES });

describe("presentArtworkFraming", () => {
  it("shows nothing for an edition with no framing, so the page is as before", () => {
    expect(present({ kind: "none", required: false, description: null, options: [] })).toEqual({
      kind: "none",
    });
    expect(present(choose([]))).toEqual({ kind: "none" });
  });

  it("describes a print that comes framed, with no choice", () => {
    expect(
      present({
        kind: "framed_by_artist",
        required: false,
        description: "Oak frame by the artist",
        options: [],
      }),
    ).toEqual({ kind: "framed_by_artist", description: "Oak frame by the artist" });
  });

  it("says when a framed-only edition cannot be bought right now", () => {
    expect(
      present({ kind: "unavailable", required: true, description: null, options: [] }),
    ).toEqual({ kind: "unavailable" });
  });

  it("offers unframed first and by default, then each option under the price", () => {
    const vm = present(
      choose([
        option(OAK, "Natural oak frame"),
        option(BLACK, "Black wood frame", { pricePence: 19500 }),
      ]),
    );
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(vm.required).toBe(false);
    expect(vm.defaultId).toBeNull();
    expect(
      vm.choices.map((choice) => [choice.id, choice.name, choice.priceLabel, choice.totalLabel]),
    ).toEqual([
      [null, "Unframed", "", "£180"],
      [OAK, "Natural oak frame", "+£210", "£390"],
      [BLACK, "Black wood frame", "+£195", "£375"],
    ]);
    expect(vm.intro).toBe("Made to order. Adds 10 to 15 working days to delivery.");
  });

  it("describes each option by its mount and glazing", () => {
    const vm = present(choose([option(OAK, "Natural oak frame")]));
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(vm.choices[1]?.detail).toBe("White conservation mount, UV-filtering acrylic");
    expect(vm.choices[1]?.leadLabel).toBe("Adds 10 to 15 working days");
  });

  it("moves the delivery dates by the option's lead time, and leaves unframed alone", () => {
    const vm = present(choose([option(OAK, "Natural oak frame")]));
    if (vm.kind !== "choose") throw new Error("expected choose");
    // Mon 2 Nov: unframed arrives 5 to 9 Nov; framed adds 10 to 15 working days: 19 Nov to 30 Nov.
    expect(vm.choices[0]?.deliveryLine).toContain("arrives 5 to 9 Nov");
    expect(vm.choices[1]?.deliveryLine).toContain("arrives 19 to 30 Nov");
    expect(vm.choices[0]?.deliveryLine).not.toEqual(vm.choices[1]?.deliveryLine);
  });

  it("has no unframed choice and no default when sold framed only", () => {
    const vm = present(choose([option(OAK, "Natural oak frame")], true));
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(vm.required).toBe(true);
    expect(vm.choices.map((choice) => choice.id)).toEqual([OAK]);
    expect(vm.defaultId).toBeUndefined();
    expect(vm.intro).toBe("This edition is sold framed. Choose a frame.");
    expect(choiceById(vm, vm.defaultId)).toBeNull();
  });

  it("finds a choice by id, unframed by null", () => {
    const vm = present(choose([option(OAK, "Natural oak frame")]));
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(choiceById(vm, null)?.name).toBe("Unframed");
    expect(choiceById(vm, OAK)?.name).toBe("Natural oak frame");
    expect(choiceById(vm, "other")).toBeNull();
  });

  it("gives each option its details for the sheet, with the time to frame", () => {
    const vm = present(choose([option(OAK, "Natural oak frame")]));
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(vm.details[0]).toEqual({
      id: OAK,
      name: "Natural oak frame",
      rows: [
        { label: "Frame", value: "Natural oak" },
        { label: "Mount", value: "White conservation mount" },
        { label: "Glazing", value: "UV-filtering acrylic" },
        { label: "Hanging", value: "D-rings and cord" },
        { label: "Time to frame", value: "10 to 15 working days" },
      ],
    });
  });

  it("names a range across options when they differ", () => {
    const vm = present(
      choose([
        option(OAK, "Natural oak frame"),
        option(BLACK, "Float", { leadTimeMinDays: 15, leadTimeMaxDays: 20 }),
      ]),
    );
    if (vm.kind !== "choose") throw new Error("expected choose");
    expect(vm.intro).toBe("Made to order. Adds 10 to 20 working days to delivery.");
  });
});
