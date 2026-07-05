import type { PublicUser } from "@/lib/data/contracts";
import { parsePublicUser } from "@/lib/data/http/parse/users.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";

/** Row schema for `GET /users/public/:id`. */
export const publicUserSchema = zTransformParse<PublicUser>(parsePublicUser);
