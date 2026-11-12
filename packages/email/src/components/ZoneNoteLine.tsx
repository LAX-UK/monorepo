import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Link, Text } from "@react-email/components";
import type { ZoneNote } from "../templates/types/moment.js";

/** "Sydney time comes from your LAX Account. Change time zone": under a local time. */
export function ZoneNoteLine({ note }: { note: ZoneNote | null | undefined }) {
  if (!note) return null;
  return (
    <Text style={line}>
      {note.city} time comes from your LAX Account.{" "}
      <Link href={note.changeUrl} style={link}>
        Change time zone
      </Link>
    </Text>
  );
}

const line = {
  color: COLORS.textMuted,
  fontFamily: FONT_STACK_BODY,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 14px",
};
const link = { color: COLORS.link, textDecoration: "underline" };
