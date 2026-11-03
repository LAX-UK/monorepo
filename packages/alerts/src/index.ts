export {
  ALERT_PRODUCTS,
  ALERT_TOPICS,
  TOPICS_BY_PRODUCT,
  isAlertProduct,
  isAlertTopic,
  productOfTopic,
  type AlertProduct,
  type AlertTopic,
} from "./domain/products.js";
export { TOPIC_CATALOGUE, type TopicDefinition } from "./domain/topic-catalogue.js";
export {
  CONFIRM_LINK_TTL_MS,
  CONFIRM_RESEND_INTERVAL_MS,
  STOP_REASONS,
  evaluateConfirmation,
  maskEmail,
  nextStatus,
  normaliseAlertEmail,
  receivesAlerts,
  shouldSendConfirmation,
  type ConfirmationOutcome,
  type SignupState,
  type StopReason,
  type SubscriberEvent,
  type SubscriberRecord,
  type SubscriberStatus,
  type TopicChangedBy,
} from "./domain/subscriber.js";
export {
  DIGEST_HOUR_LONDON,
  DIGEST_TIME_ZONE,
  digestDateFor,
  isDigestDue,
} from "./domain/london-date.js";
export {
  matchSnapshotSchema,
  type MatchSnapshot,
  type NewMatch,
  type PendingMatch,
} from "./domain/match.js";
export {
  MAX_ITEMS_PER_GROUP,
  assembleDigest,
  type DigestGroup,
  type DigestItem,
  type DigestSubgroup,
  type DigestVm,
} from "./domain/digest.js";
export {
  AlertLinkCodec,
  type LegacyLinkPolicy,
  type LinkKey,
  type LinkKeyring,
  type LinkKind,
  type LinkPayload,
  type VerifiedLink,
} from "./links/codec.js";
export { keyringFrom, webAlertUrls, type LinkKeyConfig } from "./links/urls.js";
export type * from "./ports.js";
export { SubscribeService, type AccountEnableOutcome } from "./application/subscribe.service.js";
export {
  ConfirmService,
  type ConfirmOutcome,
  type ConfirmPreview,
} from "./application/confirm.service.js";
export {
  StopService,
  type StopOutcome,
  type StopPreview,
  type StopScope,
} from "./application/stop.service.js";
export { PreferencesService, type AccountAlertsView } from "./application/preferences.service.js";
export {
  RecordMatchService,
  type AnnounceInput,
  type AnnounceResult,
} from "./application/record-match.service.js";
export {
  DigestRun,
  type DigestRunDeps,
  type DigestRunStats,
  type SendMode,
} from "./application/digest-run.js";
