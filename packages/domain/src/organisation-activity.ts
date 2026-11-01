/**
 * An organisation's Activity: its history built from domain events, for owners and admins. One
 * table says which events appear, as what, under which filter, who they are about and which of
 * their fields may be shown. Anything not in the table never appears, so a new event is private
 * until it is added here on purpose.
 */

/** The filter groups on the Activity tab. */
export const ACTIVITY_GROUPS = ["members", "bidding", "selling", "money", "security"] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

type ActivitySpec = {
  kind: string;
  group: ActivityGroup;
  /** The payload field naming the member the entry is about, if any. */
  subjectUserKey?: string;
  /** Payload fields that may be shown; everything else stays in the event. */
  detailKeys: readonly string[];
};

const ACTIVITY_SPECS = {
  "legal_entity.member_invited": {
    kind: "member_invited",
    group: "members",
    detailKeys: ["email", "role"],
  },
  "legal_entity.invitation_withdrawn": {
    kind: "invitation_withdrawn",
    group: "members",
    detailKeys: ["role"],
  },
  "legal_entity.member_declined": {
    kind: "invitation_declined",
    group: "members",
    subjectUserKey: "invitee_user_id",
    detailKeys: [],
  },
  "legal_entity.member_accepted": {
    kind: "member_joined",
    group: "members",
    subjectUserKey: "member_user_id",
    detailKeys: ["role"],
  },
  "legal_entity.member_role_changed": {
    kind: "role_changed",
    group: "members",
    subjectUserKey: "member_user_id",
    detailKeys: ["from_role", "to_role"],
  },
  "legal_entity.member_removed": {
    kind: "member_removed",
    group: "members",
    subjectUserKey: "member_user_id",
    detailKeys: ["role_at_removal"],
  },
  "legal_entity.member_left": {
    kind: "member_left",
    group: "members",
    subjectUserKey: "member_user_id",
    detailKeys: ["role_at_leaving"],
  },
  "legal_entity.buyer_agent_authorised": {
    kind: "authorisation_granted",
    group: "bidding",
    subjectUserKey: "member_user_id",
    detailKeys: ["sale_id", "bid_limit", "total_limit"],
  },
  "legal_entity.buyer_agent_authorisation_revoked": {
    kind: "authorisation_revoked",
    group: "bidding",
    subjectUserKey: "member_user_id",
    detailKeys: ["sale_id"],
  },
  "legal_entity.bidding_limit_changed": {
    kind: "bidding_limit_changed",
    group: "bidding",
    detailKeys: ["previous_limit", "limit"],
  },
  "submission.agreement_accepted": {
    kind: "agreement_accepted",
    group: "selling",
    detailKeys: ["submissionId", "termsVersion"],
  },
  "submission.unsold_choice_requested": {
    kind: "unsold_choice_made",
    group: "selling",
    detailKeys: ["submissionId", "lotId", "choice"],
  },
  "payout.paid": {
    kind: "payout_sent",
    group: "money",
    detailKeys: ["netAmount", "currency"],
  },
  "legal_entity.payout_bank_changed": {
    kind: "bank_details_changed",
    group: "money",
    detailKeys: ["bank_last4", "bank_name"],
  },
  "legal_entity.invoice_details_changed": {
    kind: "invoice_details_changed",
    group: "money",
    detailKeys: ["changed_fields"],
  },
  "auth.two_factor_policy_changed": {
    kind: "two_step_policy_changed",
    group: "security",
    detailKeys: ["required"],
  },
  "legal_entity.two_step_reminder_sent": {
    kind: "two_step_reminder_sent",
    group: "security",
    detailKeys: ["recipient_count"],
  },
} as const satisfies Record<string, ActivitySpec>;

export type ActivityEventType = keyof typeof ACTIVITY_SPECS;
export type ActivityKind = (typeof ACTIVITY_SPECS)[ActivityEventType]["kind"];

/** Every event type that can appear in Activity. */
export const ACTIVITY_EVENT_TYPES = Object.keys(ACTIVITY_SPECS) as ActivityEventType[];

/** History is kept and shown for twelve months. */
export const ACTIVITY_RETENTION_MONTHS = 12;

/** The oldest moment Activity shows, from `now`. */
export function activityRetentionStart(now: Date): Date {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - ACTIVITY_RETENTION_MONTHS);
  return start;
}

/** The event types behind the chosen groups (all of them when none is chosen). */
export function activityEventTypesFor(groups: readonly ActivityGroup[]): ActivityEventType[] {
  if (groups.length === 0) return [...ACTIVITY_EVENT_TYPES];
  return ACTIVITY_EVENT_TYPES.filter((type) =>
    groups.includes(ACTIVITY_SPECS[type].group as ActivityGroup),
  );
}

export type ActivityDetail = Record<string, string | number | boolean | null | string[]>;

/** One event as stored, before it is shown. */
export type ActivityEventRecord = {
  id: number;
  eventType: string;
  occurredAt: Date;
  actorUserId: string | null;
  payload: unknown;
};

/** One line of Activity. */
export type ActivityEntry = {
  id: number;
  kind: ActivityKind;
  group: ActivityGroup;
  occurredAt: Date;
  /** Who did it; `null` when LAX or the system did. */
  actorUserId: string | null;
  /** The member it is about, if any. */
  subjectUserId: string | null;
  detail: ActivityDetail;
};

function isActivityEventType(type: string): type is ActivityEventType {
  return Object.hasOwn(ACTIVITY_SPECS, type);
}

function isDetailValue(value: unknown): value is ActivityDetail[string] {
  if (value === null) return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === "string");
  return ["string", "number", "boolean"].includes(typeof value);
}

/** A stored event as an Activity line, or `null` when it is not one Activity shows. */
export function activityEntry(record: ActivityEventRecord): ActivityEntry | null {
  if (!isActivityEventType(record.eventType)) return null;
  const spec: ActivitySpec = ACTIVITY_SPECS[record.eventType];
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};
  const detail: ActivityDetail = {};
  for (const key of spec.detailKeys) {
    const value = payload[key];
    if (value !== undefined && isDetailValue(value)) detail[key] = value;
  }
  const subject = spec.subjectUserKey ? payload[spec.subjectUserKey] : null;
  return {
    id: record.id,
    kind: spec.kind as ActivityKind,
    group: spec.group,
    occurredAt: record.occurredAt,
    actorUserId: record.actorUserId,
    subjectUserId: typeof subject === "string" ? subject : null,
    detail,
  };
}
