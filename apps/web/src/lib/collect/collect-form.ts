import { type CollectorIssue, resolveCollector } from "@auction/domain";
import { COLLECT_COPY } from "./collect-copy";

/** The ids the error summary links to, so each line moves focus to its field. */
export const COLLECT_FIELD_IDS = {
  lots: "collect-lots",
  time: "collect-time",
  name: "collect-collector-name",
  email: "collect-collector-email",
  authorisation: "collect-collector-authorisation",
} as const;

export type CollectorChoice = "self" | "member" | "third_party";

/** Everything the person has chosen on the booking page. */
export type CollectFormState = {
  lotIds: readonly string[];
  slotStart: string | null;
  collector: CollectorChoice;
  name: string;
  email: string;
  company: string;
  authorised: boolean;
};

export type CollectFormError = { fieldId: string; message: string };

/** What the API takes, sent only after the form passes. */
export type CollectRequestBody = {
  lotIds: string[];
  slotStart: string;
  collector: {
    kind: CollectorChoice;
    name: string;
    email?: string | null;
    company?: string | null;
    authorised?: boolean;
  };
};

const ISSUE_FIELD: Record<CollectorIssue["field"], string> = {
  name: COLLECT_FIELD_IDS.name,
  email: COLLECT_FIELD_IDS.email,
  authorisation: COLLECT_FIELD_IDS.authorisation,
};

const ISSUE_MESSAGE: Record<CollectorIssue["code"], string> = {
  name_required: COLLECT_COPY.errors.name,
  email_invalid: COLLECT_COPY.errors.email,
  authorisation_required: COLLECT_COPY.errors.authorisation,
};

/** The collector's name: the person's own for "Me", what they typed otherwise. */
function collectorName(state: CollectFormState, myName: string): string {
  return state.collector === "self" ? myName : state.name;
}

/**
 * Checks the form with the same rule the server applies to the collector, and lists every
 * problem in the order the page reads (lots, time, who collects), for the error summary and the
 * fields to show the same sentences. A form that passes becomes the request, tidied.
 */
export function validateCollectForm(
  state: CollectFormState,
  myName: string,
): { ok: true; body: CollectRequestBody } | { ok: false; errors: CollectFormError[] } {
  const errors: CollectFormError[] = [];
  if (state.lotIds.length === 0) {
    errors.push({ fieldId: COLLECT_FIELD_IDS.lots, message: COLLECT_COPY.errors.lots });
  }
  if (!state.slotStart) {
    errors.push({ fieldId: COLLECT_FIELD_IDS.time, message: COLLECT_COPY.errors.time });
  }
  const thirdParty = state.collector === "third_party";
  const collector = resolveCollector({
    kind: state.collector,
    name: collectorName(state, myName),
    email: state.collector === "self" ? null : state.email,
    company: thirdParty ? state.company : null,
    authorised: thirdParty ? state.authorised : false,
  });
  if (!collector.ok) {
    for (const issue of collector.issues) {
      errors.push({ fieldId: ISSUE_FIELD[issue.field], message: ISSUE_MESSAGE[issue.code] });
    }
  }
  if (errors.length > 0 || !collector.ok || !state.slotStart) return { ok: false, errors };
  const { collector: resolved } = collector;
  return {
    ok: true,
    body: {
      lotIds: [...state.lotIds],
      slotStart: state.slotStart,
      collector: {
        kind: resolved.kind,
        name: resolved.name,
        ...(resolved.email ? { email: resolved.email } : {}),
        ...(resolved.company ? { company: resolved.company } : {}),
        ...(thirdParty ? { authorised: true } : {}),
      },
    },
  };
}

/** The sentence the authorisation box carries, naming the person it authorises. */
export function authorisationText(name: string): string {
  const who = name.trim() === "" ? "them" : name.trim();
  return `I authorise ${who} to collect these lots for me. This is the written authorisation our collection policy asks for.`;
}
