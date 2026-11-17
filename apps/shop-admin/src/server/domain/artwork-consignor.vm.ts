import type {
  AdminArtworkConsignor,
  AdminConsignor,
  AdminConsignorAgreement,
  AdminConsignorChange,
} from "@auction/shop-contracts";
import type { TimelineEvent } from "@auction/staff-ui";
import {
  AGREEMENT_STATE_BADGES,
  agreementDates,
  agreementState,
  placesSentence,
  sortAgreements,
} from "./consignor-agreement.vm";
import type { LookupOption } from "./lookup-options.vm";

/*
 * How the Consignor field reads on a From Zoho record and in the All list (ZI-5, decision pack
 * 17 November 2026, section 1, option B), and the Set consignor form's values. shop-api checks
 * every rule again and names each field it refuses.
 */

export const LAX_OWNS_LABEL = "LAX owns this work";
export const CONSIGNOR_NOT_SET = "Not set";
/** Who set a consignor, when their name is not known. */
export const UNNAMED_SETTER = "LAX staff";

/** The client's name, or "LAX owns this work". */
export function consignorName(consignor: AdminConsignor): string {
  return consignor.kind === "lax" ? LAX_OWNS_LABEL : consignor.displayName;
}

/** The client page a consignor's agreements are kept on; null for LAX. */
export function consignorHref(consignor: AdminConsignor): string | null {
  return consignor.kind === "client"
    ? `/clients/${encodeURIComponent(consignor.partyId)}#agreements`
    : null;
}

export type ConsignorAgreementLine =
  /** No consignor set yet. */
  | { kind: "not_set" }
  /** LAX owns the work: no agreement is needed. */
  | { kind: "lax" }
  /** A client with no agreement that is current (none, or all retired). */
  | { kind: "none" }
  /** The client's leading agreement: in force first, then not started, then expired. */
  | {
      kind: "agreement";
      agreement: AdminConsignorAgreement;
      badge: { label: string; tone: "success" | "info" | "neutral" | "warning" };
      places: string;
      dates: string;
      /** How many other current agreements the client has. */
      others: number;
    };

/** What the record says about the consignor's agreement on `today` (a London day). */
export function consignorAgreementLine(
  view: Pick<AdminArtworkConsignor, "current" | "agreements">,
  today: string,
): ConsignorAgreementLine {
  const consignor = view.current?.consignor ?? null;
  if (consignor === null) return { kind: "not_set" };
  if (consignor.kind === "lax") return { kind: "lax" };
  const [lead, ...rest] = sortAgreements(
    view.agreements.filter((agreement) => agreement.status === "current"),
    today,
  );
  if (!lead) return { kind: "none" };
  return {
    kind: "agreement",
    agreement: lead,
    badge: AGREEMENT_STATE_BADGES[agreementState(lead, today)],
    places: placesSentence(lead.places),
    dates: agreementDates(lead),
    others: rest.length,
  };
}

/** "1 more agreement" under the leading one. */
export function otherAgreementsNote(count: number): string {
  return `${count} more ${count === 1 ? "agreement" : "agreements"} on the client's page`;
}

/** Who set a consignor, by name; LAX staff when the name is not known. */
export const setterName = (change: Pick<AdminConsignorChange, "setByName">) =>
  change.setByName ?? UNNAMED_SETTER;

/** The consignor's changes, newest first, as the shared timeline reads them. */
export function consignorHistory(view: Pick<AdminArtworkConsignor, "history">): TimelineEvent[] {
  return view.history.map((change, index) => {
    const first = index === view.history.length - 1;
    return {
      id: change.id,
      at: change.setAt,
      actor: setterName(change),
      title: `${first ? "Set to" : "Changed to"} ${consignorName(change.consignor)}`,
      ...(change.changeReason ? { detail: change.changeReason } : {}),
    };
  });
}

/** Under the history when older changes were left out. */
export function moreHistoryNote(shown: number): string {
  return `Showing the latest ${shown} changes. Older changes are kept.`;
}

// ---------------------------------------------------------------------------------------------
// The Set consignor form
// ---------------------------------------------------------------------------------------------

export type ConsignorFormField = "kind" | "client" | "reason";

export const CONSIGNOR_FIELD_LABELS: Record<ConsignorFormField, string> = {
  kind: "Consignor",
  client: "Client",
  reason: "Reason for the change",
};

export const CONSIGNOR_FORM_FIELDS = Object.keys(CONSIGNOR_FIELD_LABELS) as ConsignorFormField[];

export const CONSIGNOR_REASON_MAX_LENGTH = 500;

export type ConsignorFormValues = {
  kind: "client" | "lax" | null;
  /** The chosen client, kept so its name shows after the search list changes. */
  client: LookupOption | null;
  reason: string;
};

export type ConsignorFormBody = {
  consignor: { kind: "client"; partyId: string } | { kind: "lax" };
  reason: string | null;
  expectedCurrentId: string | null;
};

export type ConsignorFormErrors = Partial<Record<ConsignorFormField, string>>;

/** The form as it opens: the consignor now, or nothing chosen when none is set. */
export function consignorFormValues(current: AdminConsignorChange | null): ConsignorFormValues {
  const consignor = current?.consignor ?? null;
  return {
    kind: consignor?.kind ?? null,
    client:
      consignor?.kind === "client" ? { id: consignor.partyId, label: consignor.displayName } : null,
    reason: "",
  };
}

/** Whether the form names the consignor the work already has. */
function unchanged(values: ConsignorFormValues, current: AdminConsignorChange | null): boolean {
  const consignor = current?.consignor;
  if (!consignor || values.kind !== consignor.kind) return false;
  return consignor.kind === "lax" || values.client?.id === consignor.partyId;
}

/**
 * The body to send, or each field at fault. A reason is needed for every change after the first;
 * choosing the consignor the work already has is not a change.
 */
export function checkConsignorForm(
  values: ConsignorFormValues,
  current: AdminConsignorChange | null,
): { ok: true; body: ConsignorFormBody } | { ok: false; errors: ConsignorFormErrors } {
  const errors: ConsignorFormErrors = {};
  const reason = values.reason.trim();
  if (values.kind === null) errors.kind = "Choose who consigned this work.";
  else if (values.kind === "client" && values.client === null) errors.client = "Choose a client.";
  else if (unchanged(values, current)) errors.kind = "This is the consignor already.";
  if (current !== null && reason === "") errors.reason = "Say why the consignor is changing.";
  if ([...reason].length > CONSIGNOR_REASON_MAX_LENGTH) {
    errors.reason = `Keep the reason to ${CONSIGNOR_REASON_MAX_LENGTH} characters or fewer.`;
  }
  if (Object.keys(errors).length > 0 || values.kind === null) return { ok: false, errors };
  const consignor =
    values.kind === "client" && values.client
      ? { kind: "client" as const, partyId: values.client.id }
      : { kind: "lax" as const };
  return {
    ok: true,
    body: { consignor, reason: reason || null, expectedCurrentId: current?.id ?? null },
  };
}

/** The fields shop-api named in a 400 (`issues`), each with its sentence. */
export function consignorErrorsFromIssues(
  issues: readonly unknown[] | undefined,
): ConsignorFormErrors {
  const errors: ConsignorFormErrors = {};
  for (const issue of issues ?? []) {
    if (!issue || typeof issue !== "object") continue;
    const { field, message } = issue as { field?: unknown; message?: unknown };
    if (
      typeof field === "string" &&
      typeof message === "string" &&
      (CONSIGNOR_FORM_FIELDS as string[]).includes(field) &&
      !errors[field as ConsignorFormField]
    ) {
      errors[field as ConsignorFormField] = message;
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------
// The All list
// ---------------------------------------------------------------------------------------------

/** The Consignor filter's choices with their counts: not set, LAX, then each client by name. */
export function consignorFilterOptions(
  consignors: readonly { value: string; label: string; count: number }[],
): { value: string; label: string }[] {
  return consignors.map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));
}

/** The chip for the active Consignor filter. */
export function consignorFilterChip(
  value: string,
  consignors: readonly { value: string; label: string }[] | undefined,
): string {
  return `Consignor: ${consignors?.find((option) => option.value === value)?.label ?? "Unknown client"}`;
}
