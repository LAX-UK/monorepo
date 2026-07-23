import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { LOT_AUCTION_TYPE_REGISTRY } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import { type LotAuctionType, lotAuctionTypes } from "@auction/types";
import type { UseFormReturn } from "react-hook-form";

/** Canonical staff labels — re-exported from presenter registry (DIP). */
export const LOT_AUCTION_TYPE_LABELS: Record<LotAuctionType, string> = Object.fromEntries(
  Object.entries(LOT_AUCTION_TYPE_REGISTRY).map(([key, value]) => [key, value.label]),
) as Record<LotAuctionType, string>;

export const LOT_AUCTION_TYPE_DESCRIPTIONS: Record<LotAuctionType, string> = {
  english: "Open ascending bids with optional reserve and minimum increment.",
  dutch: "Price falls over time until a bidder accepts the current price.",
  sealed: "Single confidential bid per bidder; highest wins when the lot closes.",
  buy_it_now: "Fixed purchase price; optional bidding below buy-now with increment.",
};

export type LotCatalogueSectionKey = "pricing" | "bidding" | "schedule" | "details" | "images";

export type LotCatalogueFieldKey = Extract<
  keyof AdminLotFormValues,
  | "startingPrice"
  | "reservePrice"
  | "buyNowPrice"
  | "buyerPremiumRate"
  | "minBidIncrement"
  | "autoBidEnabled"
  | "autoBidStepMin"
  | "autoBidStepMax"
  | "autoBidStepPresetsCsv"
  | "dutchDecrementAmount"
  | "dutchDecrementIntervalMs"
  | "categoryIds"
  | "startTime"
  | "endTime"
  | "medium"
  | "dimensions"
  | "artistId"
  | "images"
  | "imageAlts"
>;

export type FieldSpec = {
  visible: boolean;
  required?: boolean;
  label: string;
  helpText?: string;
  placeholder?: string;
  section: LotCatalogueSectionKey;
};

export type LotCatalogueProfile = {
  auctionType: LotAuctionType;
  label: string;
  summary: string;
  fields: Record<LotCatalogueFieldKey, FieldSpec>;
};

const EMPTY_CLEARED: Partial<AdminLotFormValues> = {
  reservePrice: "",
  buyNowPrice: "",
  buyerPremiumRate: "",
  minBidIncrement: "",
  autoBidEnabled: true,
  autoBidStepMin: "",
  autoBidStepMax: "",
  autoBidStepPresetsCsv: "",
  dutchDecrementAmount: "",
  dutchDecrementIntervalMs: "60000",
};

function hiddenField(key: LotCatalogueFieldKey, section: LotCatalogueSectionKey): FieldSpec {
  return { visible: false, label: key, section };
}

function buildProfile(auctionType: LotAuctionType): LotCatalogueProfile {
  const baseFields = {
    buyerPremiumRate: {
      visible: true,
      label: "Buyer premium rate",
      helpText: "Decimal between 0 and 1. Example: 25% = 0.25",
      placeholder: "0.25",
      section: "pricing" as const,
    },
    categoryIds: {
      visible: true,
      required: true,
      label: "Categories",
      helpText: "Choose one or more categories. The first selected is the primary.",
      section: "details" as const,
    },
    startTime: {
      visible: true,
      required: true,
      label: "Start (London)",
      section: "schedule" as const,
    },
    endTime: {
      visible: true,
      required: true,
      label: "End (London)",
      section: "schedule" as const,
    },
    medium: {
      visible: true,
      label: "Medium (optional)",
      section: "details" as const,
    },
    dimensions: {
      visible: true,
      label: "Dimensions (optional)",
      section: "details" as const,
    },
    artistId: {
      visible: true,
      label: "Artist / Maker / Brand",
      section: "details" as const,
    },
    images: {
      visible: true,
      label: "Lot images",
      section: "images" as const,
    },
    imageAlts: {
      visible: true,
      label: "Image alt text",
      section: "images" as const,
    },
    startingPrice: hiddenField("startingPrice", "pricing"),
    reservePrice: hiddenField("reservePrice", "pricing"),
    buyNowPrice: hiddenField("buyNowPrice", "pricing"),
    minBidIncrement: hiddenField("minBidIncrement", "bidding"),
    autoBidEnabled: hiddenField("autoBidEnabled", "bidding"),
    autoBidStepMin: hiddenField("autoBidStepMin", "bidding"),
    autoBidStepMax: hiddenField("autoBidStepMax", "bidding"),
    autoBidStepPresetsCsv: hiddenField("autoBidStepPresetsCsv", "bidding"),
    dutchDecrementAmount: hiddenField("dutchDecrementAmount", "bidding"),
    dutchDecrementIntervalMs: hiddenField("dutchDecrementIntervalMs", "bidding"),
  } satisfies Record<LotCatalogueFieldKey, FieldSpec>;

  switch (auctionType) {
    case "english":
      return {
        auctionType,
        label: LOT_AUCTION_TYPE_LABELS.english,
        summary: LOT_AUCTION_TYPE_DESCRIPTIONS.english,
        fields: {
          ...baseFields,
          startingPrice: {
            visible: true,
            required: true,
            label: "Starting price",
            placeholder: "0.00",
            section: "pricing",
          },
          reservePrice: {
            visible: true,
            label: "Reserve (optional)",
            placeholder: "0.00",
            section: "pricing",
          },
          minBidIncrement: {
            visible: true,
            label: "Min bid increment",
            helpText: "Minimum raise per bid. Defaults to 0.01 if left blank.",
            placeholder: "1.00",
            section: "bidding",
          },
          autoBidEnabled: {
            visible: true,
            label: "Auto-bid enabled",
            helpText: "When off, buyers cannot set proxy auto-bid on this lot.",
            section: "bidding",
          },
          autoBidStepMin: {
            visible: true,
            label: "Auto-bid step min",
            helpText: "Smallest raise buyers may choose for auto-bid. Defaults to min increment.",
            placeholder: "10.00",
            section: "bidding",
          },
          autoBidStepMax: {
            visible: true,
            label: "Auto-bid step max",
            helpText: "Largest raise buyers may choose. Leave blank to match min.",
            placeholder: "50.00",
            section: "bidding",
          },
          autoBidStepPresetsCsv: {
            visible: true,
            label: "Auto-bid step presets",
            helpText:
              "Optional comma-separated list (e.g. 10, 25, 50). When set, buyers pick from these only.",
            placeholder: "10, 25, 50",
            section: "bidding",
          },
        },
      };
    case "dutch":
      return {
        auctionType,
        label: LOT_AUCTION_TYPE_LABELS.dutch,
        summary: LOT_AUCTION_TYPE_DESCRIPTIONS.dutch,
        fields: {
          ...baseFields,
          startingPrice: {
            visible: true,
            required: true,
            label: "Starting price",
            helpText: "Opening price before decrements begin.",
            placeholder: "0.00",
            section: "pricing",
          },
          dutchDecrementAmount: {
            visible: true,
            required: true,
            label: "Decrement amount",
            helpText: "Amount the price drops each interval.",
            placeholder: "10.00",
            section: "bidding",
          },
          dutchDecrementIntervalMs: {
            visible: true,
            required: true,
            label: "Decrement interval (ms)",
            helpText: "Milliseconds between price drops. 60,000 = one minute.",
            placeholder: "60000",
            section: "bidding",
          },
        },
      };
    case "sealed":
      return {
        auctionType,
        label: LOT_AUCTION_TYPE_LABELS.sealed,
        summary: LOT_AUCTION_TYPE_DESCRIPTIONS.sealed,
        fields: {
          ...baseFields,
          startingPrice: {
            visible: true,
            required: true,
            label: "Minimum bid",
            helpText: "Lowest confidential bid accepted.",
            placeholder: "0.00",
            section: "pricing",
          },
          reservePrice: {
            visible: true,
            label: "Reserve (optional)",
            placeholder: "0.00",
            section: "pricing",
          },
        },
      };
    case "buy_it_now":
      return {
        auctionType,
        label: LOT_AUCTION_TYPE_LABELS.buy_it_now,
        summary: LOT_AUCTION_TYPE_DESCRIPTIONS.buy_it_now,
        fields: {
          ...baseFields,
          startingPrice: {
            visible: true,
            required: true,
            label: "List / floor price",
            helpText: "Current ask before optional bidding.",
            placeholder: "0.00",
            section: "pricing",
          },
          buyNowPrice: {
            visible: true,
            required: true,
            label: "Buy now price",
            placeholder: "0.00",
            section: "pricing",
          },
          minBidIncrement: {
            visible: true,
            label: "Min bid increment (optional)",
            helpText: "Minimum raise when bidding below buy-now.",
            placeholder: "1.00",
            section: "bidding",
          },
          autoBidEnabled: {
            visible: true,
            label: "Auto-bid enabled",
            helpText: "When off, buyers cannot set proxy auto-bid on this lot.",
            section: "bidding",
          },
          autoBidStepMin: {
            visible: true,
            label: "Auto-bid step min",
            helpText: "Smallest raise buyers may choose for auto-bid.",
            placeholder: "10.00",
            section: "bidding",
          },
          autoBidStepMax: {
            visible: true,
            label: "Auto-bid step max",
            helpText: "Largest raise buyers may choose.",
            placeholder: "50.00",
            section: "bidding",
          },
          autoBidStepPresetsCsv: {
            visible: true,
            label: "Auto-bid step presets",
            helpText: "Optional comma-separated list (e.g. 10, 25, 50).",
            placeholder: "10, 25, 50",
            section: "bidding",
          },
        },
      };
    default: {
      const _exhaustive: never = auctionType;
      return _exhaustive;
    }
  }
}

const profileCache = new Map<LotAuctionType, LotCatalogueProfile>(
  lotAuctionTypes.map((t) => [t, buildProfile(t)]),
);

export function getLotCatalogueProfile(auctionType: LotAuctionType): LotCatalogueProfile {
  return profileCache.get(auctionType) ?? buildProfile(auctionType);
}

export function isCatalogueSectionVisible(
  profile: LotCatalogueProfile,
  section: LotCatalogueSectionKey,
): boolean {
  return Object.values(profile.fields).some((f) => f.section === section && f.visible);
}

export function getCatalogueStepFieldKeys(
  auctionType: LotAuctionType,
  opts?: { includeArtist?: boolean },
): LotCatalogueFieldKey[] {
  const profile = getLotCatalogueProfile(auctionType);
  const keys: LotCatalogueFieldKey[] = [];
  for (const [key, spec] of Object.entries(profile.fields) as [LotCatalogueFieldKey, FieldSpec][]) {
    if (!spec.visible) continue;
    if (key === "artistId" && opts?.includeArtist === false) continue;
    if (key === "imageAlts") continue;
    keys.push(key);
  }
  return keys;
}

/** Defaults applied to fields hidden by the target auction type profile. */
export function getHiddenFieldDefaults(auctionType: LotAuctionType): Partial<AdminLotFormValues> {
  const profile = getLotCatalogueProfile(auctionType);
  const patch: Partial<AdminLotFormValues> = {};
  for (const key of Object.keys(profile.fields) as LotCatalogueFieldKey[]) {
    if (profile.fields[key].visible) continue;
    const cleared = EMPTY_CLEARED[key as keyof typeof EMPTY_CLEARED];
    if (cleared !== undefined) {
      (patch as Record<string, unknown>)[key] = cleared;
    }
  }
  return patch;
}

export function applyLotTypeFieldReset(
  form: UseFormReturn<AdminLotFormValues>,
  previousType: LotAuctionType,
  nextType: LotAuctionType,
): void {
  if (previousType === nextType) return;
  const defaults = getHiddenFieldDefaults(nextType);
  for (const [key, value] of Object.entries(defaults) as [keyof AdminLotFormValues, unknown][]) {
    form.setValue(key, value as AdminLotFormValues[typeof key], {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.clearErrors(key);
  }
}
