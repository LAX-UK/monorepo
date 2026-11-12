import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import type { EmailMoment } from "../templates/types/moment.js";

/** A time: the official value, then the recipient's own time as plain text under it. */
export function MomentValue({ moment }: { moment: EmailMoment }) {
  return (
    <>
      {moment.official}
      {moment.local ? (
        <>
          <br />
          <span style={local}>{moment.local}</span>
        </>
      ) : null}
    </>
  );
}

const local = {
  color: COLORS.textSecondary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "13px",
};
