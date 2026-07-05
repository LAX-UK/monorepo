import type { PublicUser } from "@/lib/data/contracts";
import { toObjectRecord } from "@/lib/data/http/object-guards";

/** Row parser for `GET /users/public/:id`. */
export function parsePublicUser(raw: unknown): PublicUser {
  const row = toObjectRecord(raw);
  const out: PublicUser = {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
  };
  if (row.image != null) out.image = String(row.image);
  return out;
}
