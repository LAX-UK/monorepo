export type { ICircuitBreaker } from "./interfaces/circuit-breaker.js";
export type { IClickIdStore } from "./interfaces/click-id-store.js";
export type { IMarketingEventPublisher } from "./interfaces/marketing-event-publisher.js";
export type {
  IMarketingProfileReader,
  MarketingProfile,
} from "./interfaces/marketing-profile-reader.js";
export type { IPiiHasher } from "./interfaces/pii-hasher.js";
export type {
  IUserIdentityResolver,
  ResolvedUserIdentity,
} from "./interfaces/user-identity-resolver.js";
export {
  FallbackMarketingEventPublisher,
  FallbackMarketingEventPublisher as CompositeMarketingEventPublisher,
} from "./composite-marketing-event.publisher.js";
export { InMemoryCircuitBreaker } from "./inmemory-circuit-breaker.js";
export { MetaCapiMarketingEventPublisher } from "./meta-capi-marketing-event.publisher.js";
export { ProfileUserIdentityResolver } from "./profile-user-identity.resolver.js";
export { Sha256PiiHasher } from "./sha256-pii.hasher.js";
export { mergeClientContextIntoUserData } from "./merge-client-context.js";
export { SgtmMarketingEventPublisher } from "./sgtm-marketing-event.publisher.js";
export { metaEventNameFor } from "./meta-event-name-map.js";
export {
  getMarketingEventsConfig,
  isMarketingEventsEnabled,
  type MarketingEventsConfig,
  type MarketingEventsEnv,
} from "./config.js";
