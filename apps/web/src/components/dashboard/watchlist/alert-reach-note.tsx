"use client";

import { NOTIFICATION_SETTINGS_HREF } from "@/lib/navigation/settings-links";
import Link from "next/link";

/** Under the artist and search lists: how their matches arrive, and where to change that. */
export function AlertReachNote() {
  return (
    <p className="text-lax-13 text-lax-muted">
      When email is on, matches come in one email at 08:00 London and in the app.{" "}
      <Link
        href={NOTIFICATION_SETTINGS_HREF}
        className="lax-focus rounded-lax-control text-lax-fg underline underline-offset-2"
      >
        Where alerts reach you
      </Link>
    </p>
  );
}
