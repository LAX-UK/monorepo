import type { SaleCoverSlot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type CoverDraft,
  type SlotDraft,
  canTakePinPlace,
  describeSlotIssue,
  draftFromView,
  isPlanEmpty,
  moveEntry,
  newSlotDraft,
  planCoverSave,
  slotBlockers,
  slotIssues,
  titleLengthWarning,
} from "./cover-draft";
import type { CoverLotOption, CoverView } from "./cover-view";

const SALE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
const LOT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const lots: CoverLotOption[] = [
  {
    id: LOT_A,
    lotNumber: 1,
    title: "Harbour",
    images: ["lots/a1.jpg", "lots/a2.jpg"],
    dimensions: null,
  },
  { id: LOT_B, lotNumber: 2, title: "Estuary", images: ["lots/b1.jpg"], dimensions: "90 × 120 cm" },
];

const storedSlot = (overrides: Partial<SaleCoverSlot> = {}): SaleCoverSlot => ({
  key: "covers/default.jpg",
  width: 3200,
  height: 1800,
  focal: { x: 0.7, y: 0.5 },
  zoom: 1,
  alt: "A harbour at dusk",
  analysisHash: "hash",
  ...overrides,
});

function viewWith(overrides: Partial<CoverView> = {}): CoverView {
  return {
    saleId: SALE,
    slots: {},
    home: { subtitle: null, featuredLotIds: [], consignmentDeadline: null, homePinOrder: null },
    pins: [],
    ...overrides,
  };
}

const pinned = (saleId: string, position: number) => ({
  saleId,
  title: `Sale ${position}`,
  position,
});

describe("draftFromView", () => {
  it("starts from the stored slots and home settings", () => {
    const view = viewWith({
      slots: {
        default: {
          source: "slot",
          slot: storedSlot({
            keep: { x: 0.5, y: 0.4, width: 0.2, height: 0.2 },
            toneOverride: "dark",
          }),
          issues: [],
          analysis: { status: "pending", value: null },
        },
      },
      home: {
        subtitle: "Evening sale",
        featuredLotIds: [LOT_B, LOT_A],
        consignmentDeadline: "2026-11-20T23:59:00.000Z",
        homePinOrder: 2,
      },
      pins: [pinned(OTHER, 1), pinned(SALE, 2)],
    });
    const draft = draftFromView(view, lots);
    expect(draft.slots.default).toMatchObject({
      source: { kind: "upload", key: "covers/default.jpg" },
      size: { width: 3200, height: 1800 },
      toneOverride: "dark",
      keep: { x: 0.5, y: 0.4, width: 0.2, height: 0.2 },
    });
    expect(draft.home).toEqual({
      subtitle: "Evening sale",
      featuredLotIds: [LOT_B, LOT_A],
      pinned: true,
      consignmentDay: "2026-11-20",
    });
  });

  it("finds which lot photograph a lot-based slot uses", () => {
    const view = viewWith({
      slots: {
        default: {
          source: "slot",
          slot: storedSlot({
            key: undefined as never,
            fromLot: {
              lotId: LOT_A,
              imageKey: "lots/a2.jpg",
              crop: { x: 0, y: 0, width: 1, height: 0.8 },
            },
          }),
          issues: [],
          analysis: { status: "pending", value: null },
        },
      },
    });
    expect(draftFromView(view, lots).slots.default?.source).toEqual({
      kind: "lot",
      lotId: LOT_A,
      imageIndex: 1,
      crop: { x: 0, y: 0, width: 1, height: 0.8 },
    });
  });

  it("matches a lot photograph by the end of its address", () => {
    const resolved: CoverLotOption[] = [
      {
        ...(lots[0] as CoverLotOption),
        images: ["https://cdn.example/lots/a1.jpg", "https://cdn.example/lots/a2.jpg"],
      },
    ];
    const view = viewWith({
      slots: {
        default: {
          source: "slot",
          slot: storedSlot({
            key: undefined as never,
            fromLot: { lotId: LOT_A, imageKey: "lots/a2.jpg" },
          }),
          issues: [],
          analysis: { status: "pending", value: null },
        },
      },
    });
    expect(draftFromView(view, resolved).slots.default?.source).toMatchObject({ imageIndex: 1 });
  });

  it("ignores a slot that only exists in the old cover list", () => {
    const view = viewWith({
      slots: {
        default: {
          source: "legacy",
          legacyKey: "old/a.jpg",
          issues: [],
          analysis: { status: "pending", value: null },
        },
      },
    });
    expect(draftFromView(view, lots).slots).toEqual({});
  });
});

describe("planCoverSave", () => {
  const view = viewWith({
    slots: {
      default: {
        source: "slot",
        slot: storedSlot(),
        issues: [],
        analysis: { status: "ready", value: null },
      },
    },
    pins: [pinned(OTHER, 1)],
  });
  const initial = draftFromView(view, lots);

  it("is empty when nothing changed", () => {
    expect(isPlanEmpty(planCoverSave(view, initial, initial))).toBe(true);
  });

  it("sends only the slot that changed, with trimmed alt text", () => {
    const draft: CoverDraft = {
      ...initial,
      slots: {
        default: { ...(initial.slots.default as SlotDraft), alt: "  New alt  ", zoom: 1.4 },
      },
    };
    const plan = planCoverSave(view, initial, draft);
    expect(plan.puts).toHaveLength(1);
    expect(plan.puts[0]).toMatchObject({
      name: "default",
      body: { alt: "New alt", zoom: 1.4, source: { kind: "upload", key: "covers/default.jpg" } },
    });
    expect(plan.clears).toEqual([]);
    expect(plan.home).toBeNull();
    expect(plan.pins).toBeNull();
  });

  it("clears a slot that staff removed and adds a new one", () => {
    const withoutDefault: CoverDraft = { ...initial, slots: {} };
    expect(planCoverSave(view, initial, withoutDefault).clears).toEqual(["default"]);

    const withPhone: CoverDraft = {
      ...initial,
      slots: {
        ...initial.slots,
        phone: {
          ...newSlotDraft({ kind: "upload", key: "covers/phone.jpg" }, "covers/phone.jpg", {
            width: 1400,
            height: 1400,
          }),
          alt: "Phone",
        },
      },
    };
    expect(planCoverSave(view, initial, withPhone).puts.map((put) => put.name)).toEqual(["phone"]);
  });

  it("drops an optional value that staff cleared", () => {
    const keepView = viewWith({
      slots: {
        default: {
          source: "slot",
          slot: storedSlot({ keep: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }),
          issues: [],
          analysis: { status: "pending", value: null },
        },
      },
    });
    const before = draftFromView(keepView, lots);
    const { keep: _keep, ...rest } = before.slots.default as SlotDraft;
    const plan = planCoverSave(keepView, before, { ...before, slots: { default: rest } });
    expect(plan.puts[0]?.body).not.toHaveProperty("keep");
  });

  it("sends only the home fields that changed", () => {
    const draft: CoverDraft = {
      ...initial,
      home: { ...initial.home, subtitle: "  A line of fact ", featuredLotIds: [LOT_A] },
    };
    expect(planCoverSave(view, initial, draft).home).toEqual({
      subtitle: "A line of fact",
      featuredLotIds: [LOT_A],
    });
    const cleared = planCoverSave(
      view,
      { ...initial, home: { ...initial.home, subtitle: "x" } },
      initial,
    );
    expect(cleared.home).toEqual({ subtitle: null });
  });

  it("ends the consigning deadline at the close of the chosen London day", () => {
    const draft: CoverDraft = {
      ...initial,
      home: { ...initial.home, consignmentDay: "2026-11-20" },
    };
    const deadline = planCoverSave(view, initial, draft).home?.consignmentDeadline;
    expect(deadline).toEqual(new Date("2026-11-20T23:59:00.000Z"));
    const summer: CoverDraft = {
      ...initial,
      home: { ...initial.home, consignmentDay: "2026-07-01" },
    };
    expect(planCoverSave(view, initial, summer).home?.consignmentDeadline).toEqual(
      new Date("2026-07-01T22:59:00.000Z"),
    );
  });

  it("adds this sale after the sales already pinned, and removes only itself", () => {
    const pin: CoverDraft = { ...initial, home: { ...initial.home, pinned: true } };
    expect(planCoverSave(view, initial, pin).pins).toEqual([OTHER, SALE]);

    const pinnedView = viewWith({
      pins: [pinned(OTHER, 1), pinned(SALE, 2), pinned(THIRD, 3)],
      home: { ...view.home, homePinOrder: 2 },
    });
    const before = draftFromView(pinnedView, lots);
    const unpin: CoverDraft = { ...before, home: { ...before.home, pinned: false } };
    expect(planCoverSave(pinnedView, before, unpin).pins).toEqual([OTHER, THIRD]);
  });
});

describe("pins", () => {
  it("allows a place until three sales are pinned, unless this sale already holds one", () => {
    const full = viewWith({ pins: [pinned(OTHER, 1), pinned(THIRD, 2), pinned("x", 3)] });
    expect(canTakePinPlace(full, false)).toBe(false);
    expect(canTakePinPlace(full, true)).toBe(true);
    expect(canTakePinPlace(viewWith({ pins: [pinned(OTHER, 1)] }), false)).toBe(true);
  });
});

describe("size and keep-area checks", () => {
  const upload = (size: { width: number; height: number }, over: Partial<SlotDraft> = {}) => ({
    ...newSlotDraft({ kind: "upload", key: "covers/x.jpg" }, "covers/x.jpg", size),
    alt: "Described",
    ...over,
  });

  it("flags a default picture under 2400px wide, counting the zoom", () => {
    expect(slotIssues("default", upload({ width: 1800, height: 1800 }), false)).toEqual([
      expect.objectContaining({ code: "below_floor" }),
    ]);
    expect(slotIssues("default", upload({ width: 3600, height: 2000 }), false)).toEqual([]);
    expect(
      slotIssues("default", upload({ width: 3600, height: 2000 }, { zoom: 2 }), false),
    ).toEqual([expect.objectContaining({ code: "below_floor" })]);
  });

  it("holds the wide slot to 2880 × 1080 and the phone slot to 1200 × 1200", () => {
    expect(slotIssues("wide", upload({ width: 2880, height: 1000 }), false)).toHaveLength(1);
    expect(slotIssues("wide", upload({ width: 2880, height: 1080 }), false)).toEqual([]);
    expect(slotIssues("phone", upload({ width: 640, height: 640 }), true)).toHaveLength(1);
    expect(slotIssues("phone", upload({ width: 1200, height: 1200 }), true)).toEqual([]);
  });

  it("flags a keep area a crop would cut", () => {
    const issues = slotIssues(
      "default",
      upload(
        { width: 3200, height: 3200 },
        { focal: { x: 0.5, y: 0.5 }, keep: { x: 0, y: 0, width: 0.2, height: 0.2 } },
      ),
      false,
    );
    expect(issues.some((issue) => issue.code === "keep_area_cut")).toBe(true);
  });

  it("cannot judge a picture whose size is not known yet", () => {
    expect(slotIssues("default", upload(null as never), false)).toEqual([]);
  });

  it("says what is wrong and what happens meanwhile", () => {
    const [issue] = slotIssues("phone", upload({ width: 640, height: 640 }), true);
    expect(issue && describeSlotIssue("phone", issue)).toContain("needs at least 1200 × 1200");
    expect(issue && describeSlotIssue("phone", issue)).toContain(
      "Phones show a crop of the default",
    );
  });

  it("asks for alt text before saving", () => {
    expect(
      slotBlockers("default", upload({ width: 3200, height: 1800 }, { alt: " " }), false),
    ).toEqual(["Describe the picture for screen readers."]);
  });
});

describe("helpers", () => {
  it("moves a list entry without changing the original", () => {
    const list = ["a", "b", "c"];
    expect(moveEntry(list, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveEntry(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveEntry(list, 1, 9)).toEqual(["a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("warns above 40 characters on the title and not at 40", () => {
    expect(titleLengthWarning("x".repeat(40))).toBeNull();
    expect(titleLengthWarning("x".repeat(41))).toContain("41 characters");
  });
});
