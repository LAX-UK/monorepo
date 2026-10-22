import type { EditorialLinksService } from "./application/editorial-links.service.js";
import type { EnquiryRateLimiter } from "./application/enquiry-rate-limit.js";
import type { ArtCacheInvalidator } from "./application/ports/art-cache-invalidator.js";
import type { EditorialSearchReader } from "./application/ports/editorial-search.reader.js";
import type { EditorialRepository } from "./application/ports/editorial.repository.js";
import type { HelpRepository } from "./application/ports/help.repository.js";

export type EditorialRoutesDeps = {
  editorial: EditorialRepository;
  help: HelpRepository;
  links: EditorialLinksService;
  search: EditorialSearchReader;
  previewSecret: string;
  enquiryRateLimiter: EnquiryRateLimiter;
  /** Absent in tests and local runs that have no lax.art to notify. */
  artCache?: ArtCacheInvalidator;
};
