import { z } from "zod";
import type { AlertTopic } from "./products.js";

/**
 * What an email shows about one matched item, kept with the match so an email can be built days
 * later without asking the product again. `path` is a site path; the product's origin is added
 * when the email is built.
 */
export const matchSnapshotSchema = z.object({
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  detail: z.string().max(300).optional(),
  imageUrl: z.string().url().nullish(),
  path: z.string().startsWith("/").max(500),
  /** A heading for matches that share a group: the artist, or the saved search. */
  groupLabel: z.string().max(200).optional(),
  /** The page that lists the whole group: the artist's page, or the saved search's results. */
  groupPath: z.string().startsWith("/").max(500).optional(),
  /** Why the match was made, shown under the group: the criteria the person set. */
  groupCriteria: z.string().max(300).optional(),
});
export type MatchSnapshot = z.infer<typeof matchSnapshotSchema>;

export type NewMatch = {
  subscriberId: string;
  topic: AlertTopic;
  /** `sale:<id>`, `lot:<id>`, `artwork:<id>`: unique with the subscriber and topic. */
  itemKey: string;
  /** The artist or saved search a match belongs to, for grouping. */
  groupKey: string | null;
  snapshot: MatchSnapshot;
  matchedAt: Date;
};

export type PendingMatch = {
  id: string;
  subscriberId: string;
  topic: AlertTopic;
  itemKey: string;
  groupKey: string | null;
  snapshot: MatchSnapshot;
  matchedAt: Date;
};
