import {
  type AuthoriseBuyerAgentInput,
  BUYER_AGENT_BID_LIMIT_MAX,
  instantFromAuctionDatetimeFormString,
} from "@auction/validators";

/** What someone fills in to authorise a buyer agent. Days are `YYYY-MM-DD` in London. */
export type AuthorisationDraft = {
  memberUserId: string;
  scope: "all" | "sale";
  saleId: string;
  /** Pounds as typed, e.g. "10,000" or "2500.50"; empty for no limit. */
  limit: string;
  /** The most committed at once across the scope, as typed; empty for no total. */
  totalLimit: string;
  startDay: string;
  endDay: string;
};

export type AuthorisationDraftField =
  | "memberUserId"
  | "saleId"
  | "limit"
  | "totalLimit"
  | "startDay"
  | "endDay";
export type AuthorisationDraftErrors = Partial<Record<AuthorisationDraftField, string>>;

export const EMPTY_AUTHORISATION_DRAFT: AuthorisationDraft = {
  memberUserId: "",
  scope: "all",
  saleId: "",
  limit: "",
  totalLimit: "",
  startDay: "",
  endDay: "",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Pounds from what was typed ("£10,000.50" → 10000.5); `null` when empty, NaN when unreadable. */
export function parsePounds(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number.parseFloat(cleaned);
}

/** Field errors in the words a person reads; empty when the draft can be sent. */
export function validateAuthorisationDraft(
  draft: AuthorisationDraft,
  todayDay: string,
): AuthorisationDraftErrors {
  const errors: AuthorisationDraftErrors = {};
  if (!draft.memberUserId) errors.memberUserId = "Choose who to authorise.";
  if (draft.scope === "sale" && !draft.saleId) errors.saleId = "Choose a sale.";

  const limit = parsePounds(draft.limit);
  if (limit != null && (Number.isNaN(limit) || limit <= 0)) {
    errors.limit = "Enter an amount in pounds, like 10,000.";
  } else if (limit != null && limit > BUYER_AGENT_BID_LIMIT_MAX) {
    errors.limit = "Enter a smaller amount.";
  }

  const total = parsePounds(draft.totalLimit);
  if (total != null && (Number.isNaN(total) || total <= 0)) {
    errors.totalLimit = "Enter an amount in pounds, like 25,000.";
  } else if (total != null && total > BUYER_AGENT_BID_LIMIT_MAX) {
    errors.totalLimit = "Enter a smaller amount.";
  } else if (total != null && limit != null && !Number.isNaN(limit) && total < limit) {
    errors.totalLimit = "The total can't be less than the limit for one lot.";
  }

  if (draft.startDay && !DAY.test(draft.startDay)) errors.startDay = "Enter a valid date.";
  if (draft.endDay && !DAY.test(draft.endDay)) {
    errors.endDay = "Enter a valid date.";
  } else if (draft.endDay && draft.endDay < todayDay) {
    errors.endDay = "The end date has already passed.";
  } else if (draft.endDay && draft.startDay && draft.endDay < draft.startDay) {
    errors.endDay = "The end date must be on or after the start date.";
  }
  return errors;
}

/**
 * The API body for a valid draft: a start day begins at midnight London time and an end day
 * runs to 23:59 that day, so "until 30 Nov" includes all of 30 November.
 */
export function toAuthoriseBuyerAgentInput(draft: AuthorisationDraft): AuthoriseBuyerAgentInput {
  const limit = parsePounds(draft.limit);
  const total = parsePounds(draft.totalLimit);
  return {
    memberUserId: draft.memberUserId,
    saleId: draft.scope === "sale" ? draft.saleId : null,
    bidLimit: limit != null && Number.isFinite(limit) ? limit : null,
    totalLimit: total != null && Number.isFinite(total) ? total : null,
    validFrom: draft.startDay
      ? instantFromAuctionDatetimeFormString(`${draft.startDay}T00:00`).toISOString()
      : null,
    validUntil: draft.endDay
      ? instantFromAuctionDatetimeFormString(`${draft.endDay}T23:59`).toISOString()
      : null,
  };
}

/** Today's London day as `YYYY-MM-DD`. */
export function londonToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
