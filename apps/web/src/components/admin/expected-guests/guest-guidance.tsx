import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import Link from "next/link";
import { accountBlockers } from "./guest-helpers";

export function GuestGuidance({ guest }: { guest: AdminExpectedGuestRow }) {
  const blockers = accountBlockers(guest);
  const noEntity = guest.eligibleEntities.length === 0;

  if (blockers.length === 0 && !noEntity) return null;

  return (
    <div className="space-y-1 font-body text-xs text-on-surface-variant">
      {noEntity ? (
        <p>
          Set up at desk — no eligible buyer entity.{" "}
          <Link href="#check-in" className="text-link underline">
            Open desk check-in
          </Link>
        </p>
      ) : null}
      {blockers.length > 0 ? (
        <p>
          Resolve blockers before express check-in.{" "}
          <Link
            href={`/admin/clients/${encodeURIComponent(guest.userId)}`}
            className="text-link underline"
          >
            Open client profile
          </Link>
        </p>
      ) : null}
    </div>
  );
}
