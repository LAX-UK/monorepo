"use client";

import { Count, Kbd, ShortcutKeys, StatusBadge, type StatusBadgeTone } from "@auction/ui/lax";
import { SheetSection, StateRow } from "./sheet-frame";

/** The badge set by kind of state, as the client and staff tools both show them. */
const BADGE_ROWS: ReadonlyArray<{
  label: string;
  badges: ReadonlyArray<{ tone: StatusBadgeTone; text: string }>;
}> = [
  {
    label: "Not started",
    badges: [
      { tone: "neutral", text: "Draft" },
      { tone: "neutral", text: "Not registered" },
    ],
  },
  {
    label: "In progress",
    badges: [
      { tone: "info", text: "In review" },
      { tone: "info", text: "In a sale" },
    ],
  },
  {
    label: "Done",
    badges: [
      { tone: "success", text: "Sold" },
      { tone: "success", text: "Paid" },
    ],
  },
  {
    label: "Needs you",
    badges: [
      { tone: "warning", text: "Agreement to accept" },
      { tone: "warning", text: "Outbid" },
    ],
  },
  {
    label: "Blocked",
    badges: [
      { tone: "danger", text: "Payment failed" },
      { tone: "danger", text: "Withdrawn" },
    ],
  },
];

export function SheetStatus() {
  return (
    <SheetSection
      id="status"
      title="Status badges and counts"
      description="20px, 12/16 at 500, sentence case, on the 4px badge radius. Tone, shape and words together: a ring for not started, a dot for in progress, a tick for done and an alert for needs you or blocked. One badge for all of Bid."
    >
      {() => (
        <>
          {BADGE_ROWS.map((row) => (
            <StateRow key={row.label} label={row.label}>
              {row.badges.map((badge) => (
                <StatusBadge key={badge.text} tone={badge.tone}>
                  {badge.text}
                </StatusBadge>
              ))}
            </StateRow>
          ))}
          <StateRow label="Live">
            <StatusBadge tone="live">Live now</StatusBadge>
            <StatusBadge tone="info" live>
              Opening
            </StatusBadge>
          </StateRow>
          <StateRow label="Long label">
            <StatusBadge tone="warning">Documents requested by our team</StatusBadge>
          </StateRow>
          <StateRow label="Counts">
            <Count value={14} />
            <Count value={3} tone="attention" label="waiting" />
            <Count value={128_400} />
          </StateRow>
          <StateRow label="Keys">
            <Kbd>/</Kbd>
            <ShortcutKeys keys="mod+k" />
            <ShortcutKeys keys="g h" />
          </StateRow>
        </>
      )}
    </SheetSection>
  );
}
