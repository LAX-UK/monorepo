import type {
  OnsiteEventEmailLookup,
  OnsiteEventPublicConfig,
  SegmentOption,
  SubmitRsvpResult,
} from "./rsvp-api.js";

export type RsvpUiState =
  | { kind: "email_prompt" }
  | { kind: "checking_email" }
  | { kind: "new_guest"; email: string }
  | { kind: "suspended" }
  | { kind: "event_closed" }
  | { kind: "error"; message: string }
  | {
      kind: "form";
      user: { name: string; email: string };
      segmentOptions: SegmentOption[];
      existing?: NonNullable<Extract<OnsiteEventEmailLookup, { status: "ready" }>["existingRsvp"]>;
      draft?: {
        attendanceSegment: string;
        plusOne: number;
        guestName: string;
        notes: string;
      };
      submitError?: string;
    }
  | {
      kind: "submitting";
      user: { name: string; email: string };
      segmentOptions: SegmentOption[];
    }
  | {
      kind: "success";
      result: SubmitRsvpResult;
      user: { name: string; email: string };
      segmentOptions: SegmentOption[];
      eventConfig: OnsiteEventPublicConfig;
    };

export function lookupToState(lookup: OnsiteEventEmailLookup, email: string): RsvpUiState {
  switch (lookup.status) {
    case "event_closed":
      return { kind: "event_closed" };
    case "not_registered":
      return { kind: "new_guest", email };
    case "suspended":
      return { kind: "suspended" };
    case "ready":
      return {
        kind: "form",
        user: lookup.user,
        segmentOptions: lookup.segmentOptions,
        ...(lookup.existingRsvp ? { existing: lookup.existingRsvp } : {}),
      };
  }
}

export function segmentLabel(segmentOptions: SegmentOption[], segment: string): string {
  return segmentOptions.find((option) => option.value === segment)?.label ?? segment;
}
