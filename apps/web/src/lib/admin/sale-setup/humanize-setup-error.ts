/** Map backend / Zod messages to staff-friendly copy. */
const MESSAGE_MAP: ReadonlyArray<[pattern: RegExp | string, message: string]> = [
  ["endTime must be after startTime", "Closing time must be after opening time."],
  ["End must be after start", "Closing time must be after opening time."],
  [
    "startTime must be in the future to publish",
    "Opening time must be in the future before you can go live.",
  ],
  [
    "All lots in the sale must be draft to publish",
    "Publish the whole sale at once — individual lots can’t go live separately while the sale is still a draft.",
  ],
  [
    "Onsite lots must use the sale's start and end times",
    "For onsite sales, lot times match the sale schedule automatically.",
  ],
  [
    "Lot start must not be before the sale start time",
    "This lot can’t open before the sale starts.",
  ],
  ["Lot end must not be after the sale end time", "This lot can’t close after the sale ends."],
  ["Choose at least one category", "Pick at least one category."],
  [/Must be a decimal between 0 and 1/, "Enter buyer premium as a decimal, e.g. 0.15 for 15%."],
  [
    "This seller must complete Stripe Connect onboarding before the lot can be scheduled.",
    "The seller needs to complete payout setup before this sale can go live.",
  ],
  [
    "Add at least one image before publishing this lot",
    "Add at least one image before adding this lot to a live sale.",
  ],
  [
    "Add a catalogue description before publishing this lot",
    "Add a catalogue description before adding this lot to a live sale.",
  ],
  ["Unsupported stream URL host", "Use a YouTube, Vimeo, or Twitch link."],
  [
    "Stream URL is only allowed for onsite auctions",
    "Live stream links are only for onsite sales.",
  ],
  ["Location is only allowed for onsite auctions", "Venue details are only for onsite sales."],
  ["Sale must have at least one lot to publish", "Add at least one lot before going live."],
  ["Only draft sales can be published", "Only draft sales can be published."],
  ["Title is required", "Enter a sale title."],
  ["Start is required", "Choose an opening time."],
  ["End is required", "Choose a closing time."],
  ["Choose a seller legal entity", "Choose a seller."],
  ["Display name is required", "Enter the artist name."],
  ["Preview must be before sale start", "Preview must start before the sale opens."],
];

import { connectPublishBlockedTitle } from "./field-copy";

export type HumanizeSetupErrorInput = {
  message: string;
  errorCode?: string | undefined;
};

export function humanizeSetupError(input: HumanizeSetupErrorInput): string {
  if (input.errorCode === "connect_required") {
    return connectPublishBlockedTitle();
  }
  if (input.errorCode === "onsite_location_required") {
    return "Add a saved venue or enter the venue name and address before going live.";
  }

  const raw = input.message.trim();
  if (!raw) return "Something went wrong. Please try again.";

  for (const [pattern, friendly] of MESSAGE_MAP) {
    if (typeof pattern === "string") {
      if (raw === pattern || raw.includes(pattern)) return friendly;
    } else if (pattern.test(raw)) {
      return friendly;
    }
  }

  if (/uuid|schema|JSON|must be/i.test(raw) && raw.length > 80) {
    return "Something went wrong. Check the form and try again.";
  }

  // Fallback for emergency lot add failures where the specific message wasn't recognized
  // (e.g. BullMQ scheduling failure after a successful publish step).
  if (input.errorCode === "emergency_add_publish_failed") {
    return "Could not schedule this lot for the live sale. Fix the issues and try again.";
  }

  return raw;
}
