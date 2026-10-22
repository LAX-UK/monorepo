import type { EnquiryRateLimiter } from "./application/enquiry-rate-limit.js";
import type { EditorialSearchReader } from "./application/ports/editorial-search.reader.js";
import type { EditorialRepository } from "./application/ports/editorial.repository.js";

export type EditorialRoutesDeps = {
  editorial: EditorialRepository;
  search: EditorialSearchReader;
  previewSecret: string;
  enquiryRateLimiter: EnquiryRateLimiter;
};
