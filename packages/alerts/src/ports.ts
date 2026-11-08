import type { DigestVm } from "./domain/digest.js";
import type { NewMatch, PendingMatch } from "./domain/match.js";
import type { AlertProduct, AlertTopic } from "./domain/products.js";
import type { StopReason, SubscriberRecord, TopicChangedBy } from "./domain/subscriber.js";

export interface Clock {
  now(): Date;
}

/**
 * A subscription became confirmed by the person's own act: they pressed the confirm link, or a
 * verified account switched an email topic on. Every path that does this runs the same hook.
 */
export type SubscriptionConfirmed = {
  subscriberId: string;
  product: AlertProduct;
  email: string;
  /** When the person asked, by the engine's clock. */
  at: Date;
};

export type SubscriptionConfirmedHook = (event: SubscriptionConfirmed) => Promise<void>;

export interface AlertLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export type ConsentRecord = { consentText: string; consentSource: string };

export interface SubscriberStore {
  findByEmail(product: AlertProduct, email: string): Promise<SubscriberRecord | null>;
  findById(id: string): Promise<SubscriberRecord | null>;
  findBySubject(product: AlertProduct, subjectId: string): Promise<SubscriberRecord | null>;
  /**
   * Starts (or restarts) a double opt-in request: the row becomes `pending` with this consent
   * record and a new `requestedAt`. A confirmed row is left alone, even if two requests race.
   */
  savePending(
    input: ConsentRecord & { product: AlertProduct; email: string; now: Date },
  ): Promise<SubscriberRecord>;
  /** A verified account switching alerts on: the row is `confirmed` and belongs to the account. */
  saveConfirmedForAccount(
    input: ConsentRecord & {
      product: AlertProduct;
      email: string;
      subjectId: string;
      now: Date;
    },
  ): Promise<SubscriberRecord>;
  /** Confirms a row that is still pending. False when it no longer is. */
  confirm(id: string, now: Date): Promise<boolean>;
  /** Stops a row that is not already stopped. False when nothing changed. */
  stop(id: string, reason: StopReason, now: Date): Promise<boolean>;
  linkAccount(id: string, subjectId: string, now: Date): Promise<void>;
}

export type TopicSwitch = { topic: AlertTopic; emailOn: boolean };

export type TopicRecipient = { subscriberId: string };

export interface TopicStore {
  list(subscriberId: string): Promise<TopicSwitch[]>;
  setEmail(
    subscriberId: string,
    topic: AlertTopic,
    on: boolean,
    by: TopicChangedBy,
    now: Date,
  ): Promise<void>;
  /** Confirmed subscribers with the topic's email switched on, in id order after `after`. */
  listEmailRecipients(
    topic: AlertTopic,
    after: string | null,
    limit: number,
  ): Promise<TopicRecipient[]>;
}

export interface MatchLedger {
  /** Records matches; one that already exists (same subscriber, topic and item) is skipped. */
  record(matches: readonly NewMatch[]): Promise<number>;
  /** Subscribers with matches not yet in a digest, in id order after `after`. */
  pendingSubscribers(product: AlertProduct, after: string | null, limit: number): Promise<string[]>;
  pendingFor(subscriberId: string): Promise<PendingMatch[]>;
  drop(matchIds: readonly string[], reason: string, now: Date): Promise<void>;
}

export type DigestClaim = {
  subscriberId: string;
  product: AlertProduct;
  localDate: string;
  matchIds: readonly string[];
  idempotencyKey: string;
  now: Date;
};

export type UnsentDigest = { digestId: string; subscriberId: string; idempotencyKey: string };

export interface DigestLedger {
  /**
   * Takes the person's one digest for the London day and attaches the matches to it, together.
   * Null when the day's digest already exists: the cap is a unique key, so nothing else is sent.
   */
  claim(input: DigestClaim): Promise<{ digestId: string } | null>;
  /** The matches attached to a digest. */
  matchesOf(digestId: string): Promise<PendingMatch[]>;
  /** Digests claimed for the day whose email was never confirmed sent (a crash between steps). */
  unsent(product: AlertProduct, localDate: string, limit: number): Promise<UnsentDigest[]>;
  markSent(digestId: string, now: Date): Promise<void>;
}

export interface AnnouncementStore {
  /** Records the item as announced. True only for the first call: an item is announced once. */
  claimItem(
    itemKey: string,
    announce: boolean,
    now: Date,
  ): Promise<{ first: boolean; announce: boolean; expanded: boolean }>;
  markExpanded(itemKey: string, now: Date): Promise<void>;
}

export type ConfirmationMessage = {
  product: AlertProduct;
  to: string;
  subscriberId: string;
  requestedAtMs: number;
  confirmUrl: string;
  stopUrl: string;
  oneClickUrl: string;
  expirationHours: number;
};

export type DigestMessage = {
  product: AlertProduct;
  to: string;
  subscriberId: string;
  localDate: string;
  idempotencyKey: string;
  vm: DigestVm;
  /** The topics the person has switched on, which the email names as why they get it. */
  activeTopics: readonly AlertTopic[];
  /** Absolute links, built from the product's origin. */
  siteUrl: (path: string) => string;
  stopUrl: string;
  oneClickUrl: string;
  /** Null for a visitor, who has no account to manage alerts in. */
  manageUrl: string | null;
  audience: "account" | "visitor";
};

export interface AlertMailer {
  sendConfirmation(message: ConfirmationMessage): Promise<void>;
  sendDigest(message: DigestMessage): Promise<void>;
}

/** What a digest tells a signed-in person in the app, alongside the email. */
export type DigestNoticeInput = {
  digestId: string;
  /** The account the subscription belongs to; visitors have none and get no notice. */
  subjectId: string;
  localDate: string;
  vm: DigestVm;
};

export interface DigestNoticeWriter {
  /**
   * Writes the person's in-app notices for one digest. Idempotent per digest: writing the same
   * digest again adds nothing, and a person whose app switch is off gets nothing.
   */
  write(input: DigestNoticeInput): Promise<void>;
}

export interface VerifiedAddressLookup {
  /** The account's address and whether it is verified; null when the account does not exist. */
  find(subjectId: string): Promise<{ email: string; verified: boolean } | null>;
}

export interface MatchValidator {
  /** Match ids whose item is no longer worth announcing (a withdrawn sale), with the reason. */
  staleMatches(matches: readonly PendingMatch[]): Promise<Map<string, string>>;
}

/** Where a product's links point. Each product gives its own origin and paths. */
export interface AlertUrls {
  confirm(token: string): string;
  stop(token: string): string;
  /** The address mail apps POST to for one-click unsubscribe. */
  oneClick(token: string): string;
  manage(): string | null;
  site(path: string): string;
}
