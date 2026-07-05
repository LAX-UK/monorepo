import type { SessionUser } from "@/lib/data/contracts";
import { parseSessionUser } from "@/lib/data/http/parse/session.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";

/** Row schema for `GET /users/me`. */
export const sessionUserSchema = zTransformParse<SessionUser>(parseSessionUser);
