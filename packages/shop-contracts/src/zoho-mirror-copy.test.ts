import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZOHO_MIRROR_NOT_APPLICABLE_REASONS, ZOHO_MIRROR_STATES } from "./admin-zoho-mirror.js";
import {
  ZOHO_MIRROR_BADGE_LABEL,
  ZOHO_MIRROR_COPY_RECORD_ID,
  ZOHO_MIRROR_DETAILS,
  ZOHO_MIRROR_NOT_APPLICABLE_COPY,
  ZOHO_MIRROR_OPEN_FAILED_JOBS,
  ZOHO_MIRROR_RECORD_LABEL,
  zohoMirrorBadgeName,
} from "./zoho-mirror-copy.js";

/** Z3 of the design, with its line breaks folded so a sentence can be found whole. */
const Z3 = readFileSync(
  new URL("../../../docs/design/staff-gaps-delivery-zoho-alerts.md", import.meta.url),
  "utf8",
)
  .split("**Z3.")[1]
  ?.split("**Z4.")[0]
  ?.replace(/\s+/g, " ") as string;

describe("Zoho mirror copy", () => {
  it("has a badge for every state but not applicable, and a line for every reason", () => {
    expect(Object.keys(ZOHO_MIRROR_BADGE_LABEL).sort()).toEqual(
      ZOHO_MIRROR_STATES.filter((state) => state !== "not_applicable").sort(),
    );
    expect(Object.keys(ZOHO_MIRROR_NOT_APPLICABLE_COPY).sort()).toEqual(
      [...ZOHO_MIRROR_NOT_APPLICABLE_REASONS].sort(),
    );
  });

  it("uses Z3's words and separator for the not mirrored lines Z3 approves", () => {
    for (const reason of ["mirroring_off", "not_paid", "not_in_register"] as const) {
      expect(Z3).toContain(`"${ZOHO_MIRROR_NOT_APPLICABLE_COPY[reason]}"`);
    }
    for (const line of Object.values(ZOHO_MIRROR_NOT_APPLICABLE_COPY)) {
      expect(line).toMatch(/^Not mirrored · [A-Z].*\.$/);
    }
  });

  it("writes Z3's details for each badge", () => {
    expect(
      ZOHO_MIRROR_DETAILS.mirrored({
        lastSent: "{14 Nov 2026, 16:02}",
        recordLabel: ZOHO_MIRROR_RECORD_LABEL.order,
        record: "LAX-S-10482",
      }),
    ).toBe("Mirrored to Zoho · Last sent {14 Nov 2026, 16:02}. Dispatch record LAX-S-10482.");
    expect(Z3).toContain(
      "Mirrored to Zoho · Last sent {14 Nov 2026, 16:02}. Dispatch record LAX-S-10482.",
    );
    const pending = ZOHO_MIRROR_DETAILS.pending({ retryAt: "16:10", attempt: 2 });
    expect(Z3).toContain(pending);
    expect(ZOHO_MIRROR_DETAILS.pending({ retryAt: null, attempt: 1 })).toBe(
      "Sending to Zoho · Waiting to send the latest change.",
    );
    const failed = ZOHO_MIRROR_DETAILS.failed({ error: "{redacted last_error}" });
    expect(Z3).toContain(failed);
    expect(ZOHO_MIRROR_DETAILS.failed({ error: null })).toBe(
      "Not in Zoho · Zoho refused the last change. Staff in Failed jobs can fix and replay it.",
    );
    expect(Z3).toContain(ZOHO_MIRROR_DETAILS.dry_run());
    expect(Z3).toContain(`"${ZOHO_MIRROR_COPY_RECORD_ID}"`);
    expect(Z3).toContain(`"${ZOHO_MIRROR_OPEN_FAILED_JOBS}"`);
  });

  it("names the badge button as the accessibility notes say", () => {
    expect(zohoMirrorBadgeName(ZOHO_MIRROR_BADGE_LABEL.mirrored)).toBe(
      "Zoho: Mirrored to Zoho, details",
    );
  });
});
