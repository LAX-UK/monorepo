import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import { type ArtistAlertCriteria, artistAlertCriteriaRefusal } from "@auction/domain";

/** What an artist alert covers, in a few words for the row: "Oil · £2,000 to £10,000". */
export function artistAlertSummary(alert: ArtistAlertCriteria): string {
  const parts: string[] = [];
  if (alert.medium) parts.push(alert.medium.charAt(0).toUpperCase() + alert.medium.slice(1));
  if (alert.priceMin && alert.priceMax) {
    parts.push(`${formatPounds(alert.priceMin)} to ${formatPounds(alert.priceMax)}`);
  } else if (alert.priceMin) {
    parts.push(`${formatPounds(alert.priceMin)} and up`);
  } else if (alert.priceMax) {
    parts.push(`Up to ${formatPounds(alert.priceMax)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Every new work";
}

/** The alert form as typed: amounts in pounds, with or without "£" and commas. */
export type ArtistAlertDraft = { medium: string; priceMin: string; priceMax: string };

export function artistAlertDraft(alert: ArtistAlertCriteria): ArtistAlertDraft {
  return {
    medium: alert.medium ?? "",
    priceMin: alert.priceMin ? String(Number.parseFloat(alert.priceMin)) : "",
    priceMax: alert.priceMax ? String(Number.parseFloat(alert.priceMax)) : "",
  };
}

const POUNDS = /^\d{1,12}(\.\d{1,2})?$/;

function amount(raw: string): string | null | "invalid" {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return POUNDS.test(cleaned) ? cleaned : "invalid";
}

export type ArtistAlertFormResult =
  | { ok: true; criteria: ArtistAlertCriteria }
  | { ok: false; errors: Partial<Record<"priceMin" | "priceMax", string>> };

/** The criteria to save, or what to fix: amounts in pounds, the lowest not above the highest. */
export function parseArtistAlertDraft(draft: ArtistAlertDraft): ArtistAlertFormResult {
  const priceMin = amount(draft.priceMin);
  const priceMax = amount(draft.priceMax);
  const errors: Partial<Record<"priceMin" | "priceMax", string>> = {};
  if (priceMin === "invalid") errors.priceMin = "Enter an amount in pounds, like 2000";
  if (priceMax === "invalid") errors.priceMax = "Enter an amount in pounds, like 10000";
  if (priceMin === "invalid" || priceMax === "invalid") return { ok: false, errors };
  const medium = draft.medium.trim().slice(0, 80);
  const criteria: ArtistAlertCriteria = { medium: medium || null, priceMin, priceMax };
  if (artistAlertCriteriaRefusal(criteria)) {
    return { ok: false, errors: { priceMax: "Make this at least the lowest estimate" } };
  }
  return { ok: true, criteria };
}
